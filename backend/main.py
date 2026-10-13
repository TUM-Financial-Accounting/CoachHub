from dotenv import load_dotenv
load_dotenv()

from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
import models, schemas, database, security, email_service, google_calendar, recurrence
import uuid, os, shutil, secrets

# ... (rest of imports)

models.Base.metadata.create_all(bind=database.engine)

# --- Lightweight column backfill ---
# create_all() only creates missing *tables* — it never adds new columns to a
# table that already exists. This project has no migration tool (no Alembic),
# so newly-introduced nullable columns are added here instead. Postgres'
# "ADD COLUMN IF NOT EXISTS" makes this safe to run on every startup, and a
# failure must never take the API down.
def _ensure_columns():
    from sqlalchemy import text
    statements = [
        "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category VARCHAR",
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE",
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS home_club VARCHAR",
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS trial_rating INTEGER DEFAULT 0",
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS trial_notes TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'coach'",
        "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS drawing TEXT",
        "ALTER TABLE training_series ADD COLUMN IF NOT EXISTS frequency VARCHAR DEFAULT 'weekly'",
        "ALTER TABLE training_series ADD COLUMN IF NOT EXISTS weekdays VARCHAR",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS series_id VARCHAR REFERENCES event_series(id)",
    ]
    try:
        with database.engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
    except Exception as exc:  # pragma: no cover - best-effort startup migration
        print(f"[startup] column backfill skipped: {exc}")

_ensure_columns()

# Resolve the uploads directory. Defaults to ./static/uploads but can be
# pointed at a mounted persistent volume via the UPLOAD_DIR env var. This
# matters in production: the container filesystem on Railway (and similar
# hosts) is ephemeral, so without a volume every redeploy/restart wipes the
# uploads folder — which is why uploaded player images vanish after a while.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.environ.get("UPLOAD_DIR") or os.path.join(STATIC_DIR, "uploads")
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()

# Allow Railway frontend URL via env variable, plus localhost for dev
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
if not frontend_url.startswith("http"):
    frontend_url = "https://" + frontend_url

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    frontend_url
]

# Add a wildcard for any railway app to help with initial deployment
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.railway\.app", # This allows any railway subdomain
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded media. The uploads mount is registered first (and explicitly)
# so it keeps serving files even when UPLOAD_DIR points outside the source tree
# at a mounted volume; the broader /static mount handles anything else.
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

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

# 404, not 403, so the API never confirms the admin area exists.
SUPERUSER_ROLE = "superuser"

def require_superuser(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != SUPERUSER_ROLE:
        raise HTTPException(status_code=404, detail="Not found")
    return current_user

def require_admin_unlocked(request: Request, current_user: models.User = Depends(require_superuser)) -> models.User:
    # 403 leaks nothing here: only a confirmed superuser can get this far.
    token = request.headers.get("X-Admin-Token")
    if not token or not security.decode_admin_token(token, current_user.email):
        raise HTTPException(status_code=403, detail="Admin unlock required")
    return current_user

# --- OWNERSHIP HELPERS ---
# Sessions, matches and match events have no coach_id of their own — they are
# scoped through the team they belong to. These helpers keep every endpoint
# from reading or mutating another coach's data.

def owned_team_ids(db: Session, user: models.User) -> list[str]:
    rows = db.query(models.Team.id).filter(models.Team.coach_id == user.id).all()
    return [row[0] for row in rows]

def require_owned_team(db: Session, user: models.User, team_id: Optional[str]) -> models.Team:
    team = None
    if team_id:
        team = db.query(models.Team).filter(models.Team.id == team_id, models.Team.coach_id == user.id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team

def parse_iso_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid date, expected YYYY-MM-DD")

def expand_series(frequency: str, weekdays: list[int], start_value: str, end_value: Optional[str], count: Optional[int] = None) -> tuple:
    """Validate a recurrence pattern ending on a date or after `count`
    occurrences; returns (start, end, weekdays, dates)."""
    start = parse_iso_date(start_value)
    if count is not None:
        if not (1 <= count <= recurrence.MAX_OCCURRENCES):
            raise HTTPException(status_code=400, detail=f"occurrences must be 1..{recurrence.MAX_OCCURRENCES}")
        # Far enough out for 200 monthly occurrences; trimmed to the real last date below.
        end = start.replace(year=start.year + 25, day=min(start.day, 28))
    elif end_value:
        end = parse_iso_date(end_value)
    else:
        raise HTTPException(status_code=400, detail="series_end_date or occurrences is required")
    if end < start:
        raise HTTPException(status_code=400, detail="series_end_date is before series_start_date")
    if frequency not in recurrence.FREQUENCIES:
        raise HTTPException(status_code=400, detail="frequency must be weekly, biweekly or monthly")
    if not weekdays or any(not (0 <= d <= 6) for d in weekdays):
        raise HTTPException(status_code=400, detail="weekdays must be a non-empty list of 0..6 (Mon..Sun)")
    days = sorted(set(weekdays))
    dates = recurrence.expand(start, end, frequency, days)
    if count is not None:
        dates = dates[:count]
    if not dates:
        raise HTTPException(status_code=400, detail="The pattern produces no dates in this range")
    return start, (dates[-1] if count is not None else end), days, dates

def delete_team_cascade(db: Session, team: models.Team):
    """Remove a team and everything that references it. The FK constraints on
    matches, sessions and series would otherwise abort the delete."""
    # ORM-level delete so the Match.events cascade also removes match events.
    for match in db.query(models.Match).filter(models.Match.team_id == team.id).all():
        db.delete(match)
    # Sessions before series — sessions hold the FK to training_series.
    db.query(models.TrainingSession).filter(models.TrainingSession.team_id == team.id).delete()
    db.query(models.TrainingSeries).filter(models.TrainingSeries.team_id == team.id).delete()
    db.query(models.Event).filter(models.Event.team_id == team.id).delete()
    db.query(models.EventSeries).filter(models.EventSeries.team_id == team.id).delete()
    db.delete(team)  # player_assignments are removed via the relationship cascade

# --- PUBLIC AUTH ROUTES ---

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = security.get_password_hash(user.password)
    
    token = secrets.token_urlsafe(32)
    expiration = datetime.utcnow() + timedelta(hours=24)
    
    new_user = models.User(
        email=user.email,
        password=hashed_password,
        full_name=user.full_name,
        is_verified=True,  # Auto-verify for now as requested (no DNS yet)
        verification_token=token,
        verification_token_expires=expiration
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Still send the email so the user can see it works, but login is already enabled
    email_service.send_verification_email(new_user.email, token)
    
    return new_user

@app.post("/login")
def login(user: schemas.UserLogin, response: Response, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    if not db_user or not security.verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    if not db_user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email address before logging in. Check your inbox.")
    
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
            "full_name": db_user.full_name,
            "role": db_user.role or "coach"
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

    # Same response whether or not the account exists, so this endpoint
    # can't be used to probe which email addresses are registered.
    if user:
        token = secrets.token_urlsafe(32)
        expiration = datetime.utcnow() + timedelta(hours=1)

        user.reset_token = token
        user.reset_token_expires = expiration
        db.commit()

        # Send email (or log it)
        email_service.send_reset_password_email(user.email, token)

    return {"message": "If an account exists for this email, a reset link has been sent."}

@app.post("/reset-password")
def reset_password(request: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    """Resets the password using a valid token."""
    user = db.query(models.User).filter(models.User.reset_token == request.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    # Check expiration (a missing expiry counts as expired)
    if not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired")
        
    # Hash and update password
    user.password = security.get_password_hash(request.new_password)
    
    # Clear reset token
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {"message": "Password has been successfully reset."}

@app.post("/verify-email")
def verify_email(request: schemas.VerifyEmailRequest, db: Session = Depends(database.get_db)):
    """Verifies a user's email using the token."""
    user = db.query(models.User).filter(models.User.verification_token == request.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
        
    if not user.verification_token_expires or user.verification_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification token has expired")
        
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    
    return {"message": "Email verified successfully. You can now log in."}

@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    """Return the current user's profile based on the JWT cookie."""
    return {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role or "coach"
    }

# Mirrors what the frontend offers (images, videos, PDF). Anything else —
# especially .html/.svg which the static mount would serve executable —
# is rejected.
ALLOWED_UPLOAD_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".mp4", ".webm", ".ogg", ".ogv", ".mov", ".m4v", ".mkv",
    ".pdf",
}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user)):
    """Save an uploaded file to disk and return its public URL path."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    filename = f"{uuid.uuid4()}{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/static/uploads/{filename}"}

# ==========================
#         SEASONS
# ==========================
@app.get("/seasons", response_model=list[schemas.Season])
def get_seasons(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Season).filter(models.Season.coach_id == current_user.id).all()

@app.post("/seasons", response_model=schemas.Season)
def create_season(item: schemas.SeasonCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.Season(
        name=item.name,
        coach_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/seasons/{season_id}")
def delete_season(season_id: str, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    season = db.query(models.Season).filter(models.Season.id == season_id, models.Season.coach_id == current_user.id).first()
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    # Clear everything that references the season — its teams (with their
    # matches/sessions) and any rows linked to the season directly. Without
    # this the FK constraints abort the delete with a 500.
    for team in db.query(models.Team).filter(models.Team.season_id == season_id).all():
        delete_team_cascade(db, team)
    db.query(models.TeamPlayer).filter(models.TeamPlayer.season_id == season_id).delete()
    for match in db.query(models.Match).filter(models.Match.season_id == season_id).all():
        db.delete(match)
    db.query(models.TrainingSession).filter(models.TrainingSession.season_id == season_id).delete()
    db.query(models.TrainingSeries).filter(models.TrainingSeries.season_id == season_id).delete()
    db.query(models.Event).filter(models.Event.season_id == season_id).delete()
    db.query(models.EventSeries).filter(models.EventSeries.season_id == season_id).delete()

    db.delete(season)
    db.commit()
    _gcal_resync(background, current_user)
    return {"message": "Season deleted successfully"}

# ==========================
#         FEEDBACK
# ==========================
ALLOWED_FEEDBACK_TYPES = {"bug", "feature", "question"}

@app.get("/feedback", response_model=list[schemas.FeedbackRequest])
def get_feedback(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return (
        db.query(models.FeedbackRequest)
        .filter(models.FeedbackRequest.coach_id == current_user.id)
        .order_by(models.FeedbackRequest.created_at.desc())
        .all()
    )

@app.post("/feedback", response_model=schemas.FeedbackRequest)
def create_feedback(item: schemas.FeedbackRequestCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if item.type not in ALLOWED_FEEDBACK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid feedback type")
    if not item.title.strip() or not item.description.strip():
        raise HTTPException(status_code=400, detail="Title and description are required")

    db_item = models.FeedbackRequest(
        coach_id=current_user.id,
        type=item.type,
        title=item.title.strip(),
        description=item.description.strip(),
        screenshot_urls=item.screenshot_urls,
        status="new",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# ==========================
#     ADMIN (SUPERUSER)
# ==========================
# The only cross-tenant routes: feedback, account metadata and counts, never coach content (SUPERUSER.md).

ALLOWED_FEEDBACK_STATUSES = {"new", "in_progress", "resolved"}

# In memory: resets on restart and isn't shared across workers.
ADMIN_UNLOCK_MAX_ATTEMPTS = 5
ADMIN_UNLOCK_LOCKOUT_MINUTES = 5
_admin_unlock_attempts: dict = {}

@app.post("/admin/unlock", response_model=schemas.AdminUnlockResponse)
def admin_unlock(
    item: schemas.AdminUnlockRequest,
    current_user: models.User = Depends(require_superuser),
):
    # Never 401: the frontend treats a 401 as an expired session and logs the coach out.
    if not security.admin_code_configured():
        raise HTTPException(
            status_code=503,
            detail="Admin access code is not configured on the server (ADMIN_ACCESS_CODE)",
        )

    now = datetime.utcnow()
    state = _admin_unlock_attempts.get(current_user.id)
    if state and state.get("until") and state["until"] > now:
        minutes = int((state["until"] - now).total_seconds() // 60) + 1
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {minutes} minute(s).")

    if not security.verify_admin_code(item.code):
        fails = (state.get("fails", 0) + 1) if state else 1
        locked = fails >= ADMIN_UNLOCK_MAX_ATTEMPTS
        _admin_unlock_attempts[current_user.id] = {
            "fails": 0 if locked else fails,
            "until": now + timedelta(minutes=ADMIN_UNLOCK_LOCKOUT_MINUTES) if locked else None,
        }
        raise HTTPException(status_code=403, detail="Invalid access code")

    _admin_unlock_attempts.pop(current_user.id, None)
    return schemas.AdminUnlockResponse(
        admin_token=security.create_admin_token(current_user.email),
        expires_in_minutes=security.ADMIN_UNLOCK_EXPIRE_MINUTES,
    )

@app.get("/admin/stats", response_model=schemas.AdminStats)
def admin_get_stats(db: Session = Depends(database.get_db), admin: models.User = Depends(require_admin_unlocked)):
    def count(model) -> int:
        return db.query(func.count(model.id)).scalar() or 0
    status_counts = dict(
        db.query(models.FeedbackRequest.status, func.count(models.FeedbackRequest.id))
        .group_by(models.FeedbackRequest.status)
        .all()
    )
    return schemas.AdminStats(
        users=count(models.User),
        teams=count(models.Team),
        players=count(models.Player),
        training_sessions=count(models.TrainingSession),
        matches=count(models.Match),
        feedback_total=sum(status_counts.values()),
        feedback_new=status_counts.get("new", 0),
        feedback_in_progress=status_counts.get("in_progress", 0),
        feedback_resolved=status_counts.get("resolved", 0),
    )

@app.get("/admin/users", response_model=list[schemas.AdminUserItem])
def admin_get_users(db: Session = Depends(database.get_db), admin: models.User = Depends(require_admin_unlocked)):
    team_counts = dict(
        db.query(models.Team.coach_id, func.count(models.Team.id))
        .group_by(models.Team.coach_id).all()
    )
    feedback_counts = dict(
        db.query(models.FeedbackRequest.coach_id, func.count(models.FeedbackRequest.id))
        .group_by(models.FeedbackRequest.coach_id).all()
    )
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        schemas.AdminUserItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role or "coach",
            is_verified=bool(u.is_verified),
            created_at=u.created_at,
            team_count=team_counts.get(u.id, 0),
            feedback_count=feedback_counts.get(u.id, 0),
        )
        for u in users
    ]

@app.get("/admin/feedback", response_model=list[schemas.AdminFeedbackItem])
def admin_get_feedback(db: Session = Depends(database.get_db), admin: models.User = Depends(require_admin_unlocked)):
    rows = (
        db.query(models.FeedbackRequest, models.User.email, models.User.full_name)
        .join(models.User, models.User.id == models.FeedbackRequest.coach_id)
        .order_by(models.FeedbackRequest.created_at.desc())
        .all()
    )
    return [
        schemas.AdminFeedbackItem(
            id=fb.id,
            type=fb.type,
            title=fb.title,
            description=fb.description,
            screenshot_urls=fb.screenshot_urls,
            status=fb.status,
            created_at=fb.created_at,
            coach_email=email,
            coach_name=full_name,
        )
        for fb, email, full_name in rows
    ]

@app.put("/admin/feedback/{feedback_id}/status", response_model=schemas.AdminFeedbackItem)
def admin_update_feedback_status(feedback_id: str, item: schemas.AdminFeedbackStatusUpdate, db: Session = Depends(database.get_db), admin: models.User = Depends(require_admin_unlocked)):
    if item.status not in ALLOWED_FEEDBACK_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    fb = db.query(models.FeedbackRequest).filter(models.FeedbackRequest.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    fb.status = item.status
    db.commit()
    db.refresh(fb)
    author = db.query(models.User).filter(models.User.id == fb.coach_id).first()
    return schemas.AdminFeedbackItem(
        id=fb.id,
        type=fb.type,
        title=fb.title,
        description=fb.description,
        screenshot_urls=fb.screenshot_urls,
        status=fb.status,
        created_at=fb.created_at,
        coach_email=author.email if author else "",
        coach_name=author.full_name if author else None,
    )

# ==========================
#     GOOGLE CALENDAR
# ==========================

def _google_account(db: Session, user: models.User) -> Optional[models.GoogleAccount]:
    return db.query(models.GoogleAccount).filter(models.GoogleAccount.coach_id == user.id).first()

def _google_status(db: Session, user: models.User) -> schemas.GoogleStatus:
    account = _google_account(db, user)
    return schemas.GoogleStatus(
        configured=google_calendar.is_configured(),
        connected=bool(account and account.refresh_token),
        google_email=account.google_email if account else None,
        calendar_id=account.calendar_id if account else None,
        time_zone=account.time_zone if account else None,
        push_enabled=bool(account and account.channel_id),
        last_synced_at=account.last_synced_at if account else None,
        last_error=account.last_error if account else None,
    )

@app.get("/google/status", response_model=schemas.GoogleStatus)
def google_status(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return _google_status(db, current_user)

@app.post("/google/auth-url", response_model=schemas.GoogleAuthUrl)
def google_auth_url(item: schemas.GoogleConnectRequest, current_user: models.User = Depends(get_current_user)):
    if not google_calendar.is_configured():
        raise HTTPException(status_code=503, detail="Google Calendar is not configured on the server")
    state = google_calendar.make_state(current_user.email, item.time_zone or "UTC")
    return schemas.GoogleAuthUrl(auth_url=google_calendar.build_auth_url(state))

@app.get("/auth/google/callback")
def google_callback(request: Request, background: BackgroundTasks, db: Session = Depends(database.get_db)):
    # Google redirects the browser here, so the coach comes from the signed state, not the cookie.
    def back(status: str):
        return RedirectResponse(f"{frontend_url}/?google={status}", status_code=302)

    if request.query_params.get("error"):
        return back("denied")
    code = request.query_params.get("code")
    payload = google_calendar.read_state(request.query_params.get("state") or "")
    if not code or not payload:
        return back("failed")

    user = db.query(models.User).filter(models.User.email == payload.get("sub")).first()
    if not user:
        return back("failed")

    try:
        tokens = google_calendar.exchange_code(code)
    except google_calendar.GoogleError:
        return back("failed")

    refresh = tokens.get("refresh_token")
    access = tokens.get("access_token")
    if not access:
        return back("failed")

    account = _google_account(db, user)
    if not account:
        account = models.GoogleAccount(coach_id=user.id)
        db.add(account)
    # Google omits the refresh token on re-consent; keep the stored one.
    if refresh:
        account.refresh_token = google_calendar.encrypt(refresh)
    if not account.refresh_token:
        return back("failed")
    account.access_token = google_calendar.encrypt(access)
    account.token_expires_at = datetime.utcnow() + timedelta(seconds=int(tokens.get("expires_in", 3600)))
    account.time_zone = payload.get("tz") or "UTC"
    account.google_email = google_calendar.userinfo_email(access) or account.google_email
    account.last_error = None
    db.commit()

    # Don't hold the browser on the redirect for the first sync.
    background.add_task(google_calendar.sync_in_background, user.id)
    return back("connected")

@app.post("/google/sync", response_model=schemas.GoogleSyncResult)
def google_sync(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    account = _google_account(db, current_user)
    if not account or not account.refresh_token:
        raise HTTPException(status_code=400, detail="Google Calendar is not connected")
    try:
        result = google_calendar.sync(db, account)
    except google_calendar.GoogleError as exc:
        account.last_error = str(exc)[:500]
        db.commit()
        raise HTTPException(status_code=502, detail=str(exc))
    return schemas.GoogleSyncResult(**result)

@app.delete("/google/disconnect", response_model=schemas.GoogleStatus)
def google_disconnect(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    account = _google_account(db, current_user)
    if account:
        try:
            token = google_calendar.access_token_for(db, account)
            google_calendar.stop_watch(account, token)
        except Exception:
            pass
        refresh = google_calendar.decrypt(account.refresh_token)
        if refresh:
            google_calendar.revoke(refresh)
        db.delete(account)
        db.commit()
    return _google_status(db, current_user)

@app.post("/google/webhook")
def google_webhook(request: Request, background: BackgroundTasks, db: Session = Depends(database.get_db)):
    # The channel token proves the ping belongs to our watch.
    channel_id = request.headers.get("X-Goog-Channel-ID")
    if not channel_id:
        return {"ok": True}
    account = db.query(models.GoogleAccount).filter(models.GoogleAccount.channel_id == channel_id).first()
    if not account or account.channel_token != request.headers.get("X-Goog-Channel-Token"):
        return {"ok": True}
    if request.headers.get("X-Goog-Resource-State") != "sync":
        background.add_task(google_calendar.sync_in_background, account.coach_id)
    return {"ok": True}

def _gcal_push(background: BackgroundTasks, user: models.User, kind: str, item_id: str):
    if google_calendar.is_configured():
        background.add_task(google_calendar.push_item, user.id, kind, item_id)

def _gcal_delete(background: BackgroundTasks, user: models.User, kind: str, item_id: str):
    if google_calendar.is_configured():
        background.add_task(google_calendar.delete_item, user.id, kind, item_id)

def _gcal_resync(background: BackgroundTasks, user: models.User):
    if google_calendar.is_configured():
        background.add_task(google_calendar.sync_in_background, user.id)

# ==========================
#      CALENDAR EVENTS
# ==========================
@app.get("/events", response_model=list[schemas.Event])
def get_events(team_id: Optional[str] = None, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Event).filter(models.Event.coach_id == current_user.id)
    if team_id:
        query = query.filter(models.Event.team_id == team_id)
    if season_id:
        query = query.filter(models.Event.season_id == season_id)
    return query.all()

@app.post("/events", response_model=schemas.Event)
def create_event(item: schemas.EventCreate, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if item.team_id:
        require_owned_team(db, current_user, item.team_id)
    date_obj = parse_iso_date(item.date)
    db_item = models.Event(
        title=item.title,
        description=item.description,
        location=item.location,
        date=date_obj,
        start_time=item.start_time,
        end_time=item.end_time,
        team_id=item.team_id,
        season_id=item.season_id,
        coach_id=current_user.id,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    _gcal_push(background, current_user, "event", db_item.id)
    return db_item

@app.put("/events/{id}", response_model=schemas.Event)
def update_event(
    id: str,
    item: schemas.EventCreate,
    background: BackgroundTasks,
    scope: str = "this",  # "this" | "future" | "all"
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_item = db.query(models.Event).filter(models.Event.id == id, models.Event.coach_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Event not found")

    if scope in ("future", "all") and db_item.series_id:
        # Dates stay put — the pattern is what places each occurrence.
        series = db.query(models.EventSeries).filter(
            models.EventSeries.id == db_item.series_id, models.EventSeries.coach_id == current_user.id,
        ).first()
        rows = db.query(models.Event).filter(
            models.Event.series_id == db_item.series_id, models.Event.coach_id == current_user.id,
        )
        if scope == "future":
            rows = rows.filter(models.Event.date >= db_item.date)
        for target in [series, *rows.all()]:
            if target is None:
                continue
            target.title = item.title
            target.description = item.description
            target.location = item.location
            target.start_time = item.start_time
            target.end_time = item.end_time
        db.commit()
        db.refresh(db_item)
        _gcal_resync(background, current_user)
        return db_item

    db_item.title = item.title
    db_item.description = item.description
    db_item.location = item.location
    db_item.date = parse_iso_date(item.date)
    db_item.start_time = item.start_time
    db_item.end_time = item.end_time
    db.commit()
    db.refresh(db_item)
    _gcal_push(background, current_user, "event", db_item.id)
    return db_item

@app.delete("/events/{id}")
def delete_event(
    id: str,
    background: BackgroundTasks,
    scope: str = "this",  # "this" | "future" | "all"
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_item = db.query(models.Event).filter(models.Event.id == id, models.Event.coach_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Event not found")

    if scope in ("future", "all") and db_item.series_id:
        series = db.query(models.EventSeries).filter(
            models.EventSeries.id == db_item.series_id, models.EventSeries.coach_id == current_user.id,
        ).first()
        rows = db.query(models.Event).filter(
            models.Event.series_id == db_item.series_id, models.Event.coach_id == current_user.id,
        )
        if scope == "future":
            rows = rows.filter(models.Event.date >= db_item.date)
        rows.delete(synchronize_session=False)
        if series:
            previous_day = db_item.date - timedelta(days=1)
            if scope == "all" or previous_day < series.series_start_date:
                db.delete(series)
            else:
                series.series_end_date = previous_day
        db.commit()
        _gcal_resync(background, current_user)
        return {"message": "Series events deleted"}

    db.delete(db_item)
    db.commit()
    _gcal_delete(background, current_user, "event", id)
    return {"message": "Deleted"}

@app.post("/event_series")
def create_event_series(item: schemas.EventSeriesCreate, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if item.team_id:
        require_owned_team(db, current_user, item.team_id)
    if item.season_id and not db.query(models.Season).filter(models.Season.id == item.season_id, models.Season.coach_id == current_user.id).first():
        raise HTTPException(status_code=404, detail="Season not found")
    start, end, days, dates = expand_series(item.frequency, item.weekdays, item.series_start_date, item.series_end_date, item.occurrences)

    series = models.EventSeries(
        coach_id=current_user.id, team_id=item.team_id, season_id=item.season_id,
        frequency=item.frequency, weekdays=",".join(str(d) for d in days),
        series_start_date=start, series_end_date=end,
        title=item.title, description=item.description, location=item.location,
        start_time=item.start_time, end_time=item.end_time,
    )
    db.add(series)
    db.flush()
    for d in dates:
        db.add(models.Event(
            coach_id=current_user.id, team_id=item.team_id, season_id=item.season_id,
            title=item.title, description=item.description, location=item.location,
            date=d, start_time=item.start_time, end_time=item.end_time, series_id=series.id,
        ))
    db.commit()
    _gcal_resync(background, current_user)
    return {"series_id": series.id, "occurrences_created": len(dates)}

# ==========================
#    CUSTOM FORMATIONS
# ==========================
@app.get("/custom_formations", response_model=list[schemas.CustomFormation])
def get_custom_formations(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.CustomFormation).filter(models.CustomFormation.coach_id == current_user.id).all()

@app.post("/custom_formations", response_model=schemas.CustomFormation)
def create_custom_formation(item: schemas.CustomFormationCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.CustomFormation(
        name=item.name,
        positions=item.positions,
        coach_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/custom_formations/{formation_id}")
def delete_custom_formation(formation_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    formation = db.query(models.CustomFormation).filter(models.CustomFormation.id == formation_id, models.CustomFormation.coach_id == current_user.id).first()
    if not formation:
        raise HTTPException(status_code=404, detail="Custom formation not found")
    db.delete(formation)
    db.commit()
    return {"message": "Custom formation deleted successfully"}

# ==========================
#          TEAMS
# ==========================
@app.get("/teams")
def get_teams(season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Team).filter(models.Team.coach_id == current_user.id)
    if season_id:
        query = query.filter(models.Team.season_id == season_id)
    return query.all()

@app.post("/teams", response_model=schemas.Team)
def create_team(item: schemas.TeamCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = models.Team(
        name=item.name,
        formation=item.formation,
        season_id=item.season_id,
        coach_id=current_user.id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/teams/{id}", response_model=schemas.Team)
def update_team(id: str, item: schemas.TeamCreate, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Team).filter(models.Team.id == id, models.Team.coach_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Team not found")

    renamed = db_item.name != item.name
    db_item.name = item.name
    db_item.formation = item.formation
    db.commit()
    db.refresh(db_item)
    # The team name is the title prefix on every one of its events.
    if renamed:
        _gcal_resync(background, current_user)
    return db_item

@app.post("/teams/{id}/clone")
def clone_team(id: str, target_season_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    source_team = db.query(models.Team).filter(models.Team.id == id, models.Team.coach_id == current_user.id).first()
    if not source_team:
        raise HTTPException(status_code=404, detail="Source team not found")
    
    # Create new team
    new_team = models.Team(
        name=source_team.name,
        formation=source_team.formation,
        season_id=target_season_id,
        coach_id=current_user.id
    )
    db.add(new_team)
    db.commit()
    db.refresh(new_team)
    
    # Copy players
    source_players = db.query(models.TeamPlayer).filter(models.TeamPlayer.team_id == id).all()
    for sp in source_players:
        new_tp = models.TeamPlayer(
            team_id=new_team.id,
            player_id=sp.player_id,
            season_id=target_season_id,
            performance=sp.performance
        )
        db.add(new_tp)
    
    db.commit()
    return new_team

@app.delete("/teams/{id}")
def delete_team(id: str, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Team).filter(models.Team.id == id, models.Team.coach_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Team not found")

    delete_team_cascade(db, db_item)
    db.commit()
    _gcal_resync(background, current_user)
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
    db_ex = db.query(models.Exercise).filter(models.Exercise.id == exercise_id, models.Exercise.coach_id == current_user.id).first()
    if not db_ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    # Manually update fields to ensure safety
    db_ex.name = item.name
    db_ex.category = item.category
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
    db_ex.drawing = item.drawing

    db.commit()
    db.refresh(db_ex)
    return db_ex

# --- DELETE ---
@app.delete("/exercises/{exercise_id}")
def delete_exercise(exercise_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_ex = db.query(models.Exercise).filter(models.Exercise.id == exercise_id, models.Exercise.coach_id == current_user.id).first()
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
    db_item = db.query(models.Basic).filter(models.Basic.id == id, models.Basic.coach_id == current_user.id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Item not found")
    
    db_item.name = item.name
    db_item.description = item.description
    db_item.diagram_url = item.diagram_url
    
    db.commit()
    db.refresh(db_item) # <--- THIS LINE ENSURES INSTANT UPDATES
    return db_item

@app.delete("/basics/{id}")
def delete_basic(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Basic).filter(models.Basic.id == id, models.Basic.coach_id == current_user.id).first()
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
    db_item = db.query(models.Principle).filter(models.Principle.id == id, models.Principle.coach_id == current_user.id).first()
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
    db_item = db.query(models.Principle).filter(models.Principle.id == id, models.Principle.coach_id == current_user.id).first()
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
    fields = dict(
        name=item.name,
        formation=item.formation,
        description=item.description,
        diagram_url=item.diagram_url,
        suggested_drills=item.suggested_drills,
        coach_id=current_user.id,
    )
    if item.id:
        fields["id"] = item.id
    db_item = models.Tactic(**fields)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# --- TACTICS UPDATE ---
@app.put("/matches/{id}/lineup")
def update_match_lineup(id: str, lineup: str, formation: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Match).filter(models.Match.id == id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_item: raise HTTPException(status_code=404)
    db_item.lineup = lineup
    db_item.formation = formation
    db.commit()
    return db_item

@app.put("/matches/{id}/stats")
def update_match_stats(id: str, stats: schemas.MatchStatsUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Match).filter(models.Match.id == id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_item: raise HTTPException(status_code=404)
    db_item.goals_for = stats.goals_for
    db_item.goals_against = stats.goals_against
    db_item.notes = stats.notes
    db.commit()
    return db_item

@app.get("/matches/{match_id}/events", response_model=list[schemas.MatchEvent])
def get_match_events(match_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_match: raise HTTPException(status_code=404, detail="Match not found")
    return db.query(models.MatchEvent).filter(models.MatchEvent.match_id == match_id).all()

@app.post("/matches/{match_id}/events", response_model=schemas.MatchEvent)
def create_match_event(match_id: str, event: schemas.MatchEventCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_match: raise HTTPException(status_code=404, detail="Match not found")

    db_player = db.query(models.Player).filter(models.Player.id == event.player_id, models.Player.coach_id == current_user.id).first()
    if not db_player: raise HTTPException(status_code=404, detail="Player not found")

    db_event = models.MatchEvent(
        **event.dict(),
        match_id=match_id
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@app.delete("/match_events/{id}")
def delete_match_event(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_event = (
        db.query(models.MatchEvent)
        .join(models.Match, models.MatchEvent.match_id == models.Match.id)
        .filter(models.MatchEvent.id == id, models.Match.team_id.in_(owned_team_ids(db, current_user)))
        .first()
    )
    if not db_event: raise HTTPException(status_code=404)
    db.delete(db_event)
    db.commit()
    return {"message": "Deleted"}

@app.get("/matches/{match_id}/ratings", response_model=list[schemas.MatchRating])
def get_match_ratings(match_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_match: raise HTTPException(status_code=404, detail="Match not found")
    return db.query(models.MatchRating).filter(models.MatchRating.match_id == match_id).all()

@app.put("/matches/{match_id}/ratings/{player_id}", response_model=schemas.MatchRating)
def set_match_rating(match_id: str, player_id: str, item: schemas.MatchRatingUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_match: raise HTTPException(status_code=404, detail="Match not found")
    db_player = db.query(models.Player).filter(models.Player.id == player_id, models.Player.coach_id == current_user.id).first()
    if not db_player: raise HTTPException(status_code=404, detail="Player not found")

    db_item = db.query(models.MatchRating).filter(models.MatchRating.match_id == match_id, models.MatchRating.player_id == player_id).first()
    if db_item:
        db_item.rating = item.rating
    else:
        db_item = models.MatchRating(match_id=match_id, player_id=player_id, rating=item.rating)
        db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/matches/{match_id}/ratings/{player_id}")
def delete_match_rating(match_id: str, player_id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = (
        db.query(models.MatchRating)
        .join(models.Match, models.MatchRating.match_id == models.Match.id)
        .filter(
            models.MatchRating.match_id == match_id,
            models.MatchRating.player_id == player_id,
            models.Match.team_id.in_(owned_team_ids(db, current_user)),
        )
        .first()
    )
    if not db_item: raise HTTPException(status_code=404)
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}

@app.get("/stats/ratings", response_model=list[schemas.MatchRating])
def get_season_ratings(team_id: str, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    require_owned_team(db, current_user, team_id)
    query = db.query(models.MatchRating).join(models.Match, models.MatchRating.match_id == models.Match.id).filter(models.Match.team_id == team_id)
    if season_id:
        query = query.filter(models.Match.season_id == season_id)
    return query.all()

@app.get("/stats/top-performers")
def get_top_performers(team_id: str, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    require_owned_team(db, current_user, team_id)
    # Join MatchEvent -> Match -> Team to filter by team and season
    query = db.query(models.MatchEvent).join(models.Match).filter(models.Match.team_id == team_id)
    if season_id:
        query = query.filter(models.Match.season_id == season_id)
    
    events = query.all()
    
    # Aggregate stats per player
    stats = {}
    for e in events:
        p_id = e.player_id
        if p_id not in stats:
            stats[p_id] = {"goals": 0, "assists": 0}
        if e.event_type == "Goal":
            stats[p_id]["goals"] += 1
        elif e.event_type == "Assist":
            stats[p_id]["assists"] += 1
            
    # Format for response
    result = []
    for p_id, s in stats.items():
        player = db.query(models.Player).filter(models.Player.id == p_id).first()
        if player:
            result.append({
                "player_id": p_id,
                "first_name": player.first_name,
                "last_name": player.last_name,
                "image_url": player.image_url,
                "goals": s["goals"],
                "assists": s["assists"]
            })
            
    return sorted(result, key=lambda x: (x["goals"], x["assists"]), reverse=True)

@app.put("/tactics/{id}")
def update_tactic(id: str, item: schemas.TacticCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Tactic).filter(models.Tactic.id == id, models.Tactic.coach_id == current_user.id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Item not found")

    db_item.name = item.name
    db_item.formation = item.formation
    db_item.description = item.description
    # The tactics UI doesn't send diagram_url, so a None here means "not
    # provided" — keep the stored diagram instead of wiping it.
    if item.diagram_url is not None:
        db_item.diagram_url = item.diagram_url
    db_item.suggested_drills = item.suggested_drills
    
    db.commit()
    db.refresh(db_item) # <--- THIS LINE ENSURES INSTANT UPDATES
    return db_item

@app.delete("/tactics/{id}")
def delete_tactic(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Tactic).filter(models.Tactic.id == id, models.Tactic.coach_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}



# ==========================
#    TRAINING SESSIONS
# ==========================
@app.get("/training_sessions")
def get_sessions(team_id: Optional[str] = None, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.TrainingSession)
    if team_id:
        require_owned_team(db, current_user, team_id)
        query = query.filter(models.TrainingSession.team_id == team_id)
    else:
        query = query.filter(models.TrainingSession.team_id.in_(owned_team_ids(db, current_user)))
    if season_id:
        query = query.filter(models.TrainingSession.season_id == season_id)
    return query.all()

@app.post("/training_sessions")
def create_session(item: schemas.TrainingSessionCreate, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if item.team_id:
        require_owned_team(db, current_user, item.team_id)
    date_obj = parse_iso_date(item.date)

    db_item = models.TrainingSession(
        date=date_obj,
        start_time=item.start_time,
        end_time=item.end_time,
        focus=item.focus,
        intensity=item.intensity,
        team_id=item.team_id,
        season_id=item.season_id,
        selected_players=item.selected_players,
        selected_exercises=item.selected_exercises
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    _gcal_push(background, current_user, "training", db_item.id)
    return db_item

@app.put("/training_sessions/{id}")
def update_session(
    id: str,
    item: schemas.TrainingSessionCreate,
    background: BackgroundTasks,
    scope: str = "this",  # "this" | "future" | "all"
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_item = db.query(models.TrainingSession).filter(
        models.TrainingSession.id == id,
        models.TrainingSession.team_id.in_(owned_team_ids(db, current_user)),
    ).first()
    if not db_item: raise HTTPException(status_code=404, detail="Session not found")

    date_obj = parse_iso_date(item.date)

    if scope in ("future", "all") and db_item.series_id:
        # Propagate the editable fields to every unmodified future occurrence
        # (and to the series template so further "edit future" calls reuse the
        # new values). Date / weekday changes never apply here — the recurrence
        # pattern is what makes them future occurrences in the first place.
        series = db.query(models.TrainingSeries).filter(models.TrainingSeries.id == db_item.series_id).first()
        if series:
            series.start_time = item.start_time
            series.end_time = item.end_time
            series.focus = item.focus
            series.intensity = item.intensity
            series.selected_players = item.selected_players
            series.selected_exercises = item.selected_exercises

        rows = db.query(models.TrainingSession).filter(
            models.TrainingSession.series_id == db_item.series_id,
            models.TrainingSession.is_modified == False,
        )
        if scope == "future":
            rows = rows.filter(models.TrainingSession.date >= db_item.date)
        for row in rows.all():
            row.start_time = item.start_time
            row.end_time = item.end_time
            row.focus = item.focus
            row.intensity = item.intensity
            row.selected_players = item.selected_players
            row.selected_exercises = item.selected_exercises
        db.commit()
        db.refresh(db_item)
        _gcal_resync(background, current_user)
        return db_item

    # Default "this only" — full edit on the single row, mark as detached
    # from series-wide propagation if it belongs to one.
    db_item.date = date_obj
    db_item.start_time = item.start_time
    db_item.end_time = item.end_time
    db_item.focus = item.focus
    db_item.intensity = item.intensity
    db_item.selected_players = item.selected_players
    db_item.selected_exercises = item.selected_exercises
    if db_item.series_id:
        db_item.is_modified = True

    db.commit()
    db.refresh(db_item)
    _gcal_push(background, current_user, "training", db_item.id)
    return db_item

@app.delete("/training_sessions/{id}")
def delete_session(
    id: str,
    background: BackgroundTasks,
    scope: str = "this",  # "this" | "future" | "all"
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_item = db.query(models.TrainingSession).filter(
        models.TrainingSession.id == id,
        models.TrainingSession.team_id.in_(owned_team_ids(db, current_user)),
    ).first()
    if not db_item: raise HTTPException(status_code=404)

    if scope in ("future", "all") and db_item.series_id:
        rows = db.query(models.TrainingSession).filter(models.TrainingSession.series_id == db_item.series_id)
        if scope == "future":
            rows = rows.filter(models.TrainingSession.date >= db_item.date)
        series = db.query(models.TrainingSeries).filter(models.TrainingSeries.id == db_item.series_id).first()
        for row in rows.all():
            db.delete(row)
        # Trim the series end so a subsequent rematerialise wouldn't recreate
        # the deleted dates. If we deleted from the very first occurrence,
        # drop the series entirely.
        if series:
            previous_day = db_item.date - timedelta(days=1)
            if scope == "all" or previous_day < series.series_start_date:
                db.delete(series)
            else:
                series.series_end_date = previous_day
        db.commit()
        _gcal_resync(background, current_user)
        return {"message": "Future occurrences deleted"}

    db.delete(db_item)
    db.commit()
    _gcal_delete(background, current_user, "training", id)
    return {"message": "Deleted"}


# ==========================
#  TRAINING SERIES (recurring)
# ==========================

@app.post("/training_series")
def create_training_series(
    item: schemas.TrainingSeriesCreate,
    background: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    if item.team_id:
        require_owned_team(db, current_user, item.team_id)
    weekdays = item.weekdays if item.weekdays else ([item.day_of_week] if item.day_of_week is not None else [])
    start_date, end_date, days, dates = expand_series(item.frequency, weekdays, item.series_start_date, item.series_end_date, item.occurrences)

    series = models.TrainingSeries(
        coach_id=current_user.id,
        team_id=item.team_id,
        season_id=item.season_id,
        day_of_week=days[0],
        frequency=item.frequency,
        weekdays=",".join(str(d) for d in days),
        series_start_date=start_date,
        series_end_date=end_date,
        start_time=item.start_time,
        end_time=item.end_time,
        focus=item.focus,
        intensity=item.intensity,
        selected_players=item.selected_players,
        selected_exercises=item.selected_exercises,
    )
    db.add(series)
    db.flush()  # populate series.id without committing yet

    for occurrence in dates:
        db.add(models.TrainingSession(
            team_id=item.team_id,
            season_id=item.season_id,
            date=occurrence,
            start_time=item.start_time,
            end_time=item.end_time,
            focus=item.focus,
            intensity=item.intensity,
            selected_players=item.selected_players,
            selected_exercises=item.selected_exercises,
            series_id=series.id,
            is_modified=False,
        ))

    db.commit()
    db.refresh(series)
    _gcal_resync(background, current_user)
    return {"series": series, "occurrences_created": len(dates)}


@app.delete("/training_series/{id}")
def delete_training_series(
    id: str,
    background: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    series = db.query(models.TrainingSeries).filter(models.TrainingSeries.id == id, models.TrainingSeries.coach_id == current_user.id).first()
    if not series: raise HTTPException(status_code=404)
    db.query(models.TrainingSession).filter(models.TrainingSession.series_id == id).delete()
    db.delete(series)
    db.commit()
    _gcal_resync(background, current_user)
    return {"message": "Series deleted"}

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
def get_players(team_id: Optional[str] = None, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if team_id:
        # Join with TeamPlayer to get the team-specific performance
        query = db.query(models.Player, models.TeamPlayer.performance.label("team_perf")) \
                  .join(models.TeamPlayer, models.Player.id == models.TeamPlayer.player_id) \
                  .options(joinedload(models.Player.teams)) \
                  .filter(models.Player.coach_id == current_user.id) \
                  .filter(models.TeamPlayer.team_id == team_id)
        
        if season_id:
            query = query.filter(models.TeamPlayer.season_id == season_id)
            
        results = query.all()
        
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
                # clothing_size / strong_foot were missing here, so editing a
                # player from the squad view wiped both fields on save.
                "clothing_size": p.clothing_size,
                "strong_foot": p.strong_foot,
                "mother_name": p.mother_name,
                "mother_phone": p.mother_phone,
                "father_name": p.father_name,
                "father_phone": p.father_phone,
                "attendance": p.attendance,
                "is_trial": p.is_trial,
                "home_club": p.home_club,
                "trial_rating": p.trial_rating,
                "trial_notes": p.trial_notes,
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
    require_owned_team(db, current_user, item.team_id)

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
    # Strip empty client-supplied id so SQLAlchemy falls back to the default
    # generator if the frontend didn't pre-mint one.
    data = item.dict(exclude={"team_id", "season_id"})
    if not data.get("id"):
        data.pop("id", None)
    db_item = models.Player(**data, coach_id=current_user.id)
    
    if item.team_id:
        team = db.query(models.Team).filter(models.Team.id == item.team_id).first()
        if team:
            # Note: SQLAlchemy relationship mapping. Let's explicitly save the TeamPlayer assignment.
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            
            assignment = models.TeamPlayer(
                team_id=team.id,
                player_id=db_item.id,
                season_id=item.season_id if item.season_id else "default-season"
            )
            db.add(assignment)
            db.commit()
            return db_item
            
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/players/{id}")
def update_player(id: str, item: schemas.PlayerCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Player).filter(models.Player.id == id, models.Player.coach_id == current_user.id).first()
    if not db_item: raise HTTPException(status_code=404)

    # Explicit per-field assignment, matching the pattern used by the other
    # update endpoints. We deliberately do NOT touch `id`, `team_id`, or
    # `season_id` here — those are managed via the URL path and the
    # dedicated team-assignment endpoints. Any new fields added to the
    # schema must be wired in here as well; the previous setattr-loop
    # version silently picked them up, including the optional `id` that
    # exists for client-minted UUIDs on create, which nulled the primary
    # key on every update.
    db_item.first_name = item.first_name
    db_item.last_name = item.last_name
    db_item.date_of_birth = item.date_of_birth
    db_item.position = item.position
    db_item.jersey_number = item.jersey_number
    db_item.status = item.status
    db_item.player_phone = item.player_phone
    db_item.image_url = item.image_url
    db_item.height = item.height
    db_item.weight = item.weight
    db_item.clothing_size = item.clothing_size
    db_item.strong_foot = item.strong_foot
    db_item.mother_name = item.mother_name
    db_item.mother_phone = item.mother_phone
    db_item.father_name = item.father_name
    db_item.father_phone = item.father_phone
    db_item.attendance = item.attendance
    db_item.is_trial = item.is_trial
    db_item.home_club = item.home_club
    db_item.trial_rating = item.trial_rating
    db_item.trial_notes = item.trial_notes

    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/players/{id}")
def delete_player(id: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Player).filter(models.Player.id == id, models.Player.coach_id == current_user.id).first()
    if not db_item: raise HTTPException(status_code=404)
    # Match events hold an FK to the player — remove them first or the
    # delete aborts for any player with recorded goals/assists.
    db.query(models.MatchEvent).filter(models.MatchEvent.player_id == id).delete()
    db.query(models.MatchRating).filter(models.MatchRating.player_id == id).delete()
    db.delete(db_item)
    db.commit()
    return {"message": "Deleted"}

@app.post("/players/{player_id}/teams/{team_id}")
def assign_player_to_team(player_id: str, team_id: str, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_player = db.query(models.Player).filter(models.Player.id == player_id, models.Player.coach_id == current_user.id).first()
    if not db_player: raise HTTPException(status_code=404, detail="Player not found")
    
    db_team = db.query(models.Team).filter(models.Team.id == team_id, models.Team.coach_id == current_user.id).first()
    if not db_team: raise HTTPException(status_code=404, detail="Team not found")
    
    target_season = season_id or "default-season"
    
    # Check if assignment already exists for this season
    assignment = db.query(models.TeamPlayer).filter(
        models.TeamPlayer.player_id == player_id,
        models.TeamPlayer.team_id == team_id,
        models.TeamPlayer.season_id == target_season
    ).first()
    
    if not assignment:
        db_player.team_assignments.append(models.TeamPlayer(team_id=team_id, season_id=target_season))
        db.commit()
    
    return {"message": "Assigned"}

@app.delete("/players/{player_id}/teams/{team_id}")
def remove_player_from_team(player_id: str, team_id: str, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_player = db.query(models.Player).filter(models.Player.id == player_id, models.Player.coach_id == current_user.id).first()
    if not db_player: raise HTTPException(status_code=404, detail="Player not found")
    
    db_team = db.query(models.Team).filter(models.Team.id == team_id, models.Team.coach_id == current_user.id).first()
    if not db_team: raise HTTPException(status_code=404, detail="Team not found")
    
    target_season = season_id or "default-season"
    
    # We delete the specific row from team_players (the association table)
    db.query(models.TeamPlayer).filter(
        models.TeamPlayer.player_id == player_id,
        models.TeamPlayer.team_id == team_id,
        models.TeamPlayer.season_id == target_season
    ).delete()
    
    db.commit()
        
    return {"message": "Removed"}


@app.get("/match/suggested-formation")
def get_suggested_formation(team_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Calculate date for 7 days ago
    seven_days_ago = datetime.now().date() - timedelta(days=7)

    # 2. Get sessions from the last week, ordered by date (newest first)
    query = db.query(models.TrainingSession).filter(models.TrainingSession.date >= seven_days_ago)
    if team_id:
        require_owned_team(db, current_user, team_id)
        query = query.filter(models.TrainingSession.team_id == team_id)
    else:
        query = query.filter(models.TrainingSession.team_id.in_(owned_team_ids(db, current_user)))
        
    sessions = query.order_by(models.TrainingSession.date.desc()).all()
    
    # 3. Iterate through sessions to find a formation
    for session in sessions:
        if not session.selected_exercises:
            continue
            
        # These are IDs coming from the frontend, so let's call them exercise_ids
        exercise_ids = [x.strip() for x in session.selected_exercises.split(',') if x.strip()]

        # Scoped to the current coach — without the coach filter this could
        # match another coach's identically-named tactic or exercise.
        exercises = db.query(models.Exercise).filter(
            models.Exercise.id.in_(exercise_ids),
            models.Exercise.coach_id == current_user.id,
        ).all()

        for exercise in exercises:
            if exercise.linked_tactics:
                # Tactics are likely stored by Name inside the Exercise object (based on your frontend logic)
                tactic_names = [t.strip() for t in exercise.linked_tactics.split(',') if t.strip()]

                # Fetch tactics by NAME
                tactic = db.query(models.Tactic).filter(
                    models.Tactic.name.in_(tactic_names),
                    models.Tactic.coach_id == current_user.id,
                ).first()
                
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
def create_match(item: schemas.MatchCreate, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if item.team_id:
        require_owned_team(db, current_user, item.team_id)
    date_obj = parse_iso_date(item.date)

    db_item = models.Match(
        opponent=item.opponent,
        date=date_obj,
        time=item.time,
        location=item.location,
        formation=item.formation,
        lineup=item.lineup, 
        team_id=item.team_id,
        season_id=item.season_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    _gcal_push(background, current_user, "match", db_item.id)
    return db_item

@app.get("/matches")
def get_all_matches(team_id: Optional[str] = None, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Match)
    if team_id:
        require_owned_team(db, current_user, team_id)
        query = query.filter(models.Match.team_id == team_id)
    else:
        query = query.filter(models.Match.team_id.in_(owned_team_ids(db, current_user)))
    if season_id:
        query = query.filter(models.Match.season_id == season_id)
    return query.order_by(models.Match.date.desc()).all()

@app.get("/matches/latest")
def get_latest_match(team_id: Optional[str] = None, season_id: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    today = date.today()

    if team_id:
        require_owned_team(db, current_user, team_id)
        team_filter = [team_id]
    else:
        team_filter = owned_team_ids(db, current_user)

    query = db.query(models.Match).filter(models.Match.date >= today, models.Match.team_id.in_(team_filter))
    if season_id:
        query = query.filter(models.Match.season_id == season_id)

    match = query.order_by(models.Match.date.asc()).first()

    if not match:
        fallback_query = db.query(models.Match).filter(models.Match.team_id.in_(team_filter))
        match = fallback_query.order_by(models.Match.date.desc()).first()

    return match

@app.delete("/matches/{match_id}")
def delete_match(match_id: str, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    # ORM-level delete so the Match.events cascade also removes recorded
    # goals/assists — a bulk query delete would trip over the FK instead.
    db.delete(db_match)
    db.commit()
    _gcal_delete(background, current_user, "match", match_id)
    return {"message": "Deleted"}

@app.put("/matches/{match_id}")
def update_match(match_id: str, item: schemas.MatchCreate, background: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_match = db.query(models.Match).filter(models.Match.id == match_id, models.Match.team_id.in_(owned_team_ids(db, current_user))).first()
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")

    date_obj = parse_iso_date(item.date)

    db_match.opponent = item.opponent
    db_match.date = date_obj
    db_match.time = item.time
    db_match.location = item.location
    db_match.formation = item.formation
    db_match.lineup = item.lineup

    db.commit()
    db.refresh(db_match)
    _gcal_push(background, current_user, "match", db_match.id)
    return db_match