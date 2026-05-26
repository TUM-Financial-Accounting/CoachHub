from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional, List

# ==========================
#         SEASONS
# ==========================
class SeasonCreate(BaseModel):
    name: str

class Season(SeasonCreate):
    id: str
    class Config:
        orm_mode = True

# ==========================
#      TEAM & PLAYERS
# ==========================
class TeamCreate(BaseModel):
    name: str
    formation: str = "4-4-2"
    season_id: Optional[str] = None

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
    season_id: Optional[str] = None
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
    season_id: Optional[str] = None
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
    season_id: Optional[str] = None
    formation: Optional[str] = "4-4-2"
    lineup: Optional[str] = None
    goals_for: Optional[int] = 0
    goals_against: Optional[int] = 0
    notes: Optional[str] = ""

class MatchStatsUpdate(BaseModel):
    goals_for: int
    goals_against: int
    notes: Optional[str] = ""

class MatchEventCreate(BaseModel):
    player_id: str
    event_type: str # "Goal", "Assist"
    minute: Optional[int] = None

class MatchEvent(MatchEventCreate):
    id: str
    match_id: str
    class Config:
        orm_mode = True

class Match(MatchCreate):
    id: str
    date : date
    class Config:
        orm_mode = True

# ==========================
#    CUSTOM FORMATIONS
# ==========================
class CustomFormationCreate(BaseModel):
    name: str
    positions: str # JSON string

class CustomFormation(CustomFormationCreate):
    id: str
    class Config:
        orm_mode = True



# ==========================
#         VISION
# ==========================
class VisionCreate(BaseModel):
    title: str
    filename: str

class Vision(VisionCreate):
    id: str
    uploaded_at: datetime
    class Config:
        orm_mode = True

# ==========================
#        PLAYBOOK
# ==========================
class PlaybookExport(BaseModel):
    basics: list[Basic]
    principles: list[Principle]
    tactics: list[Tactic]
    exercises: list[Exercise]

class PlaybookImport(BaseModel):
    basics: list[BasicCreate]
    principles: list[PrincipleCreate]
    tactics: list[TacticCreate]
    exercises: list[ExerciseCreate]

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
    is_verified: bool = False

    class Config:
        orm_mode = True
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    token: str

class PerformanceUpdate(BaseModel):
    performance: int
    team_id: Optional[str] = None

# ==========================
#         FEEDBACK
# ==========================
class FeedbackRequestCreate(BaseModel):
    type: str          # 'bug' | 'feature' | 'question'
    title: str
    description: str
    screenshot_urls: Optional[List[str]] = None

class FeedbackRequest(FeedbackRequestCreate):
    id: str
    status: str
    created_at: datetime
    class Config:
        orm_mode = True
        from_attributes = True