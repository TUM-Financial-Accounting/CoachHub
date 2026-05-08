from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
import models, schemas, database, security, email_service
import uuid, os, shutil, secrets

# ... (rest of imports)

models.Base.metadata.create_all(bind=database.engine)

# Ensure uploads directory exists (relative to repo root, where uvicorn is launched)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()

# Allow Railway frontend URL via env variable, plus localhost for dev
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
if not frontend_url.startswith("http"):
    frontend_url = "https://" + frontend_url

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    frontend_url
]
# Remove duplicates
origins = list(set(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files as static assets
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")), name="static")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- AUTH HELPER (Reading from Cookie) ---
def get_current_user(request: Request, db: Session = Depends(database.get_db)):
    # Look for 'access_token' in cookies or Authorization header
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    payload = security.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
        
    email: str = payload.get("sub")
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- PUBLIC AUTH ROUTES ---

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = security.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        password=hashed_password,
        full_name=user.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login")
def login(user: schemas.UserLogin, response: Response, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    if not db_user or not security.verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create JWT Token
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    
    is_cross_origin = frontend_url.startswith("https://")

    # Set HttpOnly Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="none" if is_cross_origin else "lax",
        secure=is_cross_origin,
    )
    
    return {
        "message": "Login successful",
        "access_token": access_token,
        "user": {
            "email": db_user.email,
            "full_name": db_user.full_name
        }
    }

@app.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if token:
        security.blacklist_token(token)
    response.delete_cookie("access_token")
    return {"message": "Logged out"}

@app.post("/forgot-password")
def forgot_password(request: schemas.ForgotPasswordRequest, db: Session = Depends(database.get_db)):
    """Generates a password reset token and sends an email."""
    user = db.query(models.User).filter(models.User.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address.")
        
    # Generate secure random token
    token = secrets.token_urlsafe(32)
    expiration = datetime.utcnow() + timedelta(hours=1)
    
    user.reset_token = token
    user.reset_token_expires = expiration
    db.commit()
    
    # Send email (or log it)
    email_service.send_reset_password_email(user.email, token)
        
    return {"message": "A reset link has been sent to your email address."}

@app.post("/reset-password")
def reset_password(request: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    """Resets the password using a valid token."""
    user = db.query(models.User).filter(models.User.reset_token == request.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    # Check expiration
    if user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired")
        
    # Hash and update password
    user.password = security.get_password_hash(request.new_password)
    
    # Clear reset token
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {"message": "Password has been successfully reset."}

@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    """Return the current user's profile based on the JWT cookie."""
    return {
        "email": current_user.email,
        "full_name": current_user.full_name
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user)):
    """Save an uploaded file to disk and return its public URL path."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    filename = f"{uuid.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/static/uploads/{filename}"}

# ==========================
#          TEAMS
# ==========================
@app.get("/teams")
def get_teams(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Team).filter(models.Team.coach_id == current_user.id).all()

@app.post("/teams", response_model=schemas.Team)
def create_team(item: schemas.TeamCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.Team(
        name=item.name,
        formation=item.formation,
        coach_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/teams/{id}", response_model=schemas.Team)
def update_team(id: str, item: schemas.TeamCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Team).filter(models.Team.id == id, models.Team.coach_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Team not found")
    
    db_item.name = item.name
    db_item.formation = item.formation
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/teams/{id}")
def delete_team(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Team).filter(models.Team.id == id, models.Team.coach_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Team not found")
    
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}

# --- GET ALL EXERCISES ---
@app.get("/exercises")
def get_exercises(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Exercise).filter(models.Exercise.coach_id == current_user.id).all()

# --- CREATE ---
@app.post("/exercises", response_model=schemas.Exercise)
def create_exercise(item: schemas.ExerciseCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.Exercise(**item.dict(), coach_id=current_user.id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# --- UPDATE (Fixing the 500 Error here) ---
@app.put("/exercises/{exercise_id}", response_model=schemas.Exercise)
def update_exercise(exercise_id: str, item: schemas.ExerciseCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_ex = db.query(models.Exercise).filter(models.Exercise.id == exercise_id).first()
    if not db_ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    # Manually update fields to ensure safety
    db_ex.name = item.name
    db_ex.description = item.description
    db_ex.intensity = item.intensity
    db_ex.setup = item.setup
    db_ex.variations = item.variations
    db_ex.coaching_points = item.coaching_points
    db_ex.goalkeepers = item.goalkeepers
    db_ex.equipment = item.equipment
    db_ex.linked_basics = item.linked_basics
    db_ex.linked_principles = item.linked_principles
    db_ex.linked_tactics = item.linked_tactics
    db_ex.media_url = item.media_url

    db.commit()
    db.refresh(db_ex)
    return db_ex

# --- DELETE ---
@app.delete("/exercises/{exercise_id}")
def delete_exercise(exercise_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_ex = db.query(models.Exercise).filter(models.Exercise.id == exercise_id).first()
    if not db_ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    db.delete(db_ex)
    db.commit()
    return {"message": "Deleted"}

# ==========================
#      BASICS LIBRARY
# ==========================
@app.get("/basics")
def get_basics(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Basic).filter(models.Basic.coach_id == current_user.id).all()

@app.post("/basics")
def create_basic(item: schemas.BasicCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.Basic(
        name=item.name, 
        description=item.description,
        diagram_url=item.diagram_url,
        coach_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/basics/{id}")
def update_basic(id: str, item: schemas.BasicCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Basic).filter(models.Basic.id == id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Item not found")
    
    db_item.name = item.name
    db_item.description = item.description
    db_item.diagram_url = item.diagram_url
    
    db.commit()
    db.refresh(db_item) # <--- THIS LINE ENSURES INSTANT UPDATES
    return db_item

@app.delete("/basics/{id}")
def delete_basic(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Basic).filter(models.Basic.id == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}


# ==========================
#    PRINCIPLES LIBRARY
# ==========================
@app.get("/principles")
def get_principles(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Principle).filter(models.Principle.coach_id == current_user.id).all()

@app.post("/principles")
def create_principle(item: schemas.PrincipleCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.Principle(
        name=item.name, 
        game_phase=item.game_phase, 
        description=item.description,
        coaching_notes=item.coaching_notes,
        implementation_tips=item.implementation_tips,
        media_url=item.media_url, # <-- Added
        coach_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/principles/{id}")
def update_principle(id: str, item: schemas.PrincipleCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Principle).filter(models.Principle.id == id).first()
    if not db_item: raise HTTPException(status_code=404)
    
    db_item.name = item.name
    db_item.game_phase = item.game_phase
    db_item.description = item.description
    db_item.coaching_notes = item.coaching_notes
    db_item.implementation_tips = item.implementation_tips
    db_item.media_url = item.media_url # <-- Added
    
    db.commit()
    db.refresh(db_item) # This ensures we get the updated object back
    return db_item

@app.delete("/principles/{id}")
def delete_principle(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Principle).filter(models.Principle.id == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}


# ==========================
#     TACTICS LIBRARY
# ==========================
@app.get("/tactics")
def get_tactics(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Tactic).filter(models.Tactic.coach_id == current_user.id).all()

@app.post("/tactics")
def create_tactic(item: schemas.TacticCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.Tactic(
        name=item.name, 
        formation=item.formation, 
        description=item.description,
        diagram_url=item.diagram_url,
        suggested_drills=item.suggested_drills,
        coach_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# --- TACTICS UPDATE ---
@app.put("/tactics/{id}")
def update_tactic(id: str, item: schemas.TacticCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Tactic).filter(models.Tactic.id == id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Item not found")
    
    db_item.name = item.name
    db_item.formation = item.formation
    db_item.description = item.description
    db_item.diagram_url = item.diagram_url
    db_item.suggested_drills = item.suggested_drills
    
    db.commit()
    db.refresh(db_item) # <--- THIS LINE ENSURES INSTANT UPDATES
    return db_item

@app.delete("/tactics/{id}")
def delete_tactic(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Tactic).filter(models.Tactic.id == id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}



# ==========================
#    TRAINING SESSIONS
# ==========================
@app.get("/training_sessions")
def get_sessions(team_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.TrainingSession)
    if team_id:
        query = query.filter(models.TrainingSession.team_id == team_id)
    return query.all()

@app.post("/training_sessions")
def create_session(item: schemas.TrainingSessionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Convert string date to Python Date object if needed, or keep as string/date in model
    import datetime
    date_obj = datetime.datetime.strptime(item.date, "%Y-%m-%d").date()
    
    db_item = models.TrainingSession(
        date=date_obj,
        start_time=item.start_time,
        end_time=item.end_time,
        focus=item.focus,
        intensity=item.intensity,
        selected_players=item.selected_players,
        selected_exercises=item.selected_exercises,
        team_id=item.team_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/training_sessions/{id}")
def update_session(id: str, item: schemas.TrainingSessionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.TrainingSession).filter(models.TrainingSession.id == id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Session not found")
    
    # Parse date again
    import datetime
    date_obj = datetime.datetime.strptime(item.date, "%Y-%m-%d").date()

    db_item.date = date_obj
    db_item.start_time = item.start_time
    db_item.end_time = item.end_time
    db_item.focus = item.focus
    db_item.intensity = item.intensity
    db_item.selected_players = item.selected_players
    db_item.selected_exercises = item.selected_exercises
    
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/training_sessions/{id}")
def delete_session(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.TrainingSession).filter(models.TrainingSession.id == id).first()
    if not db_item: raise HTTPException(status_code=404)
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}

# ==========================
#    PLAYERS (Helper)
# ==========================
# We need this to populate the "Available Players" list in the Training Modal
# ==========================
#    PLAYERS
# ==========================
# --- VISION ---
@app.get("/visions", response_model=list[schemas.Vision])
def get_visions(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Vision).filter(models.Vision.coach_id == current_user.id).order_by(models.Vision.uploaded_at.desc()).all()

@app.post("/visions", response_model=schemas.Vision)
def create_vision(vision: schemas.VisionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    new_vision = models.Vision(**vision.dict(), coach_id=current_user.id)
    db.add(new_vision)
    db.commit()
    db.refresh(new_vision)
    return new_vision

@app.delete("/visions/{id}")
def delete_vision(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    vision = db.query(models.Vision).filter(models.Vision.id == id, models.Vision.coach_id == current_user.id).first()
    if not vision:
        raise HTTPException(status_code=404, detail="Vision not found")
    
    # Optional: Delete file from disk
    try:
        file_path = os.path.join(UPLOAD_DIR, vision.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    except:
        pass

    db.delete(vision)
    db.commit()
    return {"message": "Vision deleted"}

# --- PLAYBOOK IMPORT/EXPORT ---
@app.get("/playbook/export", response_model=schemas.PlaybookExport)
def export_playbook(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    basics = db.query(models.Basic).filter(models.Basic.coach_id == current_user.id).all()
    principles = db.query(models.Principle).filter(models.Principle.coach_id == current_user.id).all()
    tactics = db.query(models.Tactic).filter(models.Tactic.coach_id == current_user.id).all()
    exercises = db.query(models.Exercise).filter(models.Exercise.coach_id == current_user.id).all()
    
    return {
        "basics": basics,
        "principles": principles,
        "tactics": tactics,
        "exercises": exercises
    }

@app.post("/playbook/import")
def import_playbook(data: schemas.PlaybookImport, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    count = 0
    # Basics
    for b in data.basics:
        exists = db.query(models.Basic).filter(models.Basic.coach_id == current_user.id, models.Basic.name == b.name).first()
        if not exists:
            db.add(models.Basic(**b.dict(), coach_id=current_user.id))
            count += 1
    # Principles
    for p in data.principles:
        exists = db.query(models.Principle).filter(models.Principle.coach_id == current_user.id, models.Principle.name == p.name).first()
        if not exists:
            db.add(models.Principle(**p.dict(), coach_id=current_user.id))
            count += 1
    # Tactics
    for t in data.tactics:
        exists = db.query(models.Tactic).filter(models.Tactic.coach_id == current_user.id, models.Tactic.name == t.name).first()
        if not exists:
            db.add(models.Tactic(**t.dict(), coach_id=current_user.id))
            count += 1
    # Exercises
    for e in data.exercises:
        exists = db.query(models.Exercise).filter(models.Exercise.coach_id == current_user.id, models.Exercise.name == e.name).first()
        if not exists:
            db.add(models.Exercise(**e.dict(), coach_id=current_user.id))
            count += 1
    db.commit()
    return {"message": f"Successfully imported {count} items. Duplicately named items were skipped."}

@app.get("/players")
def get_players(team_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if team_id:
        # Join with TeamPlayer to get the team-specific performance
        results = db.query(models.Player, models.TeamPlayer.performance.label("team_perf")) \
                  .join(models.TeamPlayer, models.Player.id == models.TeamPlayer.player_id) \
                  .options(joinedload(models.Player.teams)) \
                  .filter(models.Player.coach_id == current_user.id) \
                  .filter(models.TeamPlayer.team_id == team_id) \
                  .all()
        
        final_players = []
        for p, team_perf in results:
            # Create a clone of the player data to avoid mutating the tracked model instance
            # which would cause the global performance to be overwritten by the team-specific one.
            player_dict = {
                "id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "date_of_birth": p.date_of_birth,
                "position": p.position,
                "jersey_number": p.jersey_number,
                "status": p.status,
                "player_phone": p.player_phone,
                "image_url": p.image_url,
                "height": p.height,
                "weight": p.weight,
                "mother_name": p.mother_name,
                "mother_phone": p.mother_phone,
                "father_name": p.father_name,
                "father_phone": p.father_phone,
                "attendance": p.attendance,
                "performance": team_perf,
                "teams": p.teams
            }
            final_players.append(player_dict)
        return final_players
    
    return db.query(models.Player).options(joinedload(models.Player.teams)).filter(models.Player.coach_id == current_user.id).all()

@app.put("/players/{id}/performance")
def update_performance(id: str, item: schemas.PerformanceUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if not item.team_id:
        raise HTTPException(status_code=400, detail="team_id is required for performance updates")
        
    assignment = db.query(models.TeamPlayer).filter(
        models.TeamPlayer.player_id == id,
        models.TeamPlayer.team_id == item.team_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    assignment.performance = item.performance
    db.commit()
    return {"message": "Performance updated"}

@app.post("/players")
def create_player(item: schemas.PlayerCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    data = item.dict(exclude={"team_id"})
    db_item = models.Player(**data, coach_id=current_user.id)
    
    if item.team_id:
        team = db.query(models.Team).filter(models.Team.id == item.team_id).first()
        if team:
            db_item.team_assignments.append(models.TeamPlayer(team_id=team.id))
            
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/players/{id}")
def update_player(id: str, item: schemas.PlayerCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Player).filter(models.Player.id == id).first()
    if not db_item: raise HTTPException(status_code=404)
    
    for key, value in item.dict().items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/players/{id}")
def delete_player(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Player).filter(models.Player.id == id).first()
    if not db_item: raise HTTPException(status_code=404)
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}

@app.post("/players/{player_id}/teams/{team_id}")
def assign_player_to_team(player_id: str, team_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_player = db.query(models.Player).filter(models.Player.id == player_id, models.Player.coach_id == current_user.id).first()
    if not db_player: raise HTTPException(status_code=404, detail="Player not found")
    
    db_team = db.query(models.Team).filter(models.Team.id == team_id, models.Team.coach_id == current_user.id).first()
    if not db_team: raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if assignment already exists
    assignment = db.query(models.TeamPlayer).filter(
        models.TeamPlayer.player_id == player_id,
        models.TeamPlayer.team_id == team_id
    ).first()
    
    if not assignment:
        db_player.team_assignments.append(models.TeamPlayer(team_id=team_id))
        db.commit()
    
    return {"message": "Assigned"}

@app.delete("/players/{player_id}/teams/{team_id}")
def remove_player_from_team(player_id: str, team_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_player = db.query(models.Player).filter(models.Player.id == player_id, models.Player.coach_id == current_user.id).first()
    if not db_player: raise HTTPException(status_code=404, detail="Player not found")
    
    db_team = db.query(models.Team).filter(models.Team.id == team_id, models.Team.coach_id == current_user.id).first()
    if not db_team: raise HTTPException(status_code=404, detail="Team not found")
    
    if db_team in db_player.teams:
        db_player.teams.remove(db_team)
        db.commit()
        
    return {"message": "Removed"}


@app.get("/match/suggested-formation")
def get_suggested_formation(team_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Calculate date for 7 days ago
    seven_days_ago = datetime.now().date() - timedelta(days=7)
    
    # 2. Get sessions from the last week, ordered by date (newest first)
    query = db.query(models.TrainingSession).filter(models.TrainingSession.date >= seven_days_ago)
    if team_id:
        query = query.filter(models.TrainingSession.team_id == team_id)
        
    sessions = query.order_by(models.TrainingSession.date.desc()).all()
    
    # 3. Iterate through sessions to find a formation
    for session in sessions:
        if not session.selected_exercises:
            continue
            
        # These are IDs coming from the frontend, so let's call them exercise_ids
        exercise_ids = [x.strip() for x in session.selected_exercises.split(',') if x.strip()]
        
        # FIX: Query using .id instead of .name
        exercises = db.query(models.Exercise).filter(models.Exercise.id.in_(exercise_ids)).all()
        
        for exercise in exercises:
            if exercise.linked_tactics:
                # Tactics are likely stored by Name inside the Exercise object (based on your frontend logic)
                tactic_names = [t.strip() for t in exercise.linked_tactics.split(',') if t.strip()]
                
                # Fetch tactics by NAME
                tactic = db.query(models.Tactic).filter(models.Tactic.name.in_(tactic_names)).first()
                
                if tactic and tactic.formation:
                    return {
                        "formation": tactic.formation, 
                        "source": f"Based on {session.date} training ({exercise.name})"
                    }

    # 4. Fallback if no formation is found
    return {"formation": "4-4-2", "source": "Default"}


# ==========================
#      MATCH MANAGEMENT
# ==========================
@app.post("/matches", response_model=schemas.Match)
def create_match(item: schemas.MatchCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    import datetime
    date_obj = datetime.datetime.strptime(item.date, "%Y-%m-%d").date()
    
    db_item = models.Match(
        opponent=item.opponent,
        date=date_obj,
        time=item.time,
        location=item.location,
        formation=item.formation,
        lineup=item.lineup, # <--- Add this
        team_id=item.team_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/matches")
def get_all_matches(team_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Match)
    if team_id:
        query = query.filter(models.Match.team_id == team_id)
    return query.order_by(models.Match.date.desc()).all()

@app.get("/matches/latest")
def get_latest_match(team_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    import datetime
    today = datetime.date.today()
    
    query = db.query(models.Match).filter(models.Match.date >= today)
    if team_id:
        query = query.filter(models.Match.team_id == team_id)
        
    match = query.order_by(models.Match.date.asc()).first()
        
    if not match:
        fallback_query = db.query(models.Match)
        if team_id:
            fallback_query = fallback_query.filter(models.Match.team_id == team_id)
        match = fallback_query.order_by(models.Match.date.desc()).first()
        
    return match

@app.put("/matches/{match_id}")
def update_match(match_id: str, item: schemas.MatchCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")

    import datetime
    date_obj = datetime.datetime.strptime(item.date, "%Y-%m-%d").date()
    
    db_match.opponent = item.opponent
    db_match.date = date_obj
    db_match.time = item.time
    db_match.location = item.location
    db_match.formation = item.formation
    db_match.lineup = item.lineup
    
    db.commit()
    db.refresh(db_match)
    return db_match