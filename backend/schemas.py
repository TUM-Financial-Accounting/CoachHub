from datetime import date
from pydantic import BaseModel
from typing import Optional

# ==========================
#      TEAM & PLAYERS
# ==========================
class TeamCreate(BaseModel):
    name: str
    formation: str

class Team(TeamCreate):
    id: str
    class Config:
        orm_mode = True

class PlayerCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    position: str
    jersey_number: int
    status: str
    team_id: Optional[str] = None
    player_phone: Optional[str] = ""
    image_url: Optional[str] = ""
    height: int = 0
    weight: int = 0
    mother_name: Optional[str] = ""
    mother_phone: Optional[str] = ""
    father_name: Optional[str] = ""
    father_phone: Optional[str] = ""
    attendance: int = 0

class Player(PlayerCreate):
    id: str
    performance: int = 0
    teams: list[Team] = []
    class Config:
        orm_mode = True

# ==========================
#        LIBRARIES
# ==========================
class BasicCreate(BaseModel):
    name: str
    description: str
    diagram_url: Optional[str] = None

class Basic(BasicCreate):
    id: str
    class Config:
        orm_mode = True

class PrincipleCreate(BaseModel):
    name: str
    game_phase: str
    description: str
    coaching_notes: Optional[str] = ""
    implementation_tips: Optional[str] = ""
    media_url: Optional[str] = None

class Principle(PrincipleCreate):
    id: str
    class Config:
        orm_mode = True

class TacticCreate(BaseModel):
    name: str
    formation: str
    description: str
    diagram_url: Optional[str] = None
    suggested_drills: Optional[str] = ""

class Tactic(TacticCreate):
    id: str
    class Config:
        orm_mode = True

# ==========================
#        EXERCISES
# ==========================
class ExerciseCreate(BaseModel):
    name: str
    intensity: str
    description: str
    setup: Optional[str] = ""
    variations: Optional[str] = ""
    coaching_points: Optional[str] = ""
    goalkeepers: int = 0
    equipment: Optional[str] = "" 
    linked_basics: Optional[str] = ""
    linked_principles: Optional[str] = ""
    linked_tactics: Optional[str] = ""
    media_url: Optional[str] = None

class Exercise(ExerciseCreate):
    id: str
    class Config:
        orm_mode = True

# ==========================
#    TRAINING SESSIONS
# ==========================
class TrainingSessionCreate(BaseModel):
    date: str
    start_time: str
    end_time: str
    focus: str
    team_id: Optional[str] = None
    intensity: str
    selected_players: str   # stored as comma-separated string
    selected_exercises: str # stored as comma-separated string

class TrainingSession(TrainingSessionCreate):
    id: str
    class Config:
        orm_mode = True

# ==========================
#    MATCHES 
# ==========================
class MatchCreate(BaseModel):
    opponent: str
    date: str
    time: str
    location: str
    team_id: Optional[str] = None
    formation: Optional[str] = "4-4-2"
    lineup: Optional[str] = None

class Match(MatchCreate):
    id: str
    date : date
    class Config:
        orm_mode = True



# --- AUTH ---
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None

    class Config:
        orm_mode = True

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class PerformanceUpdate(BaseModel):
    performance: int
    team_id: Optional[str] = None