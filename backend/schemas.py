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
    # Optional client-supplied UUID. Lets the frontend pre-generate the id so
    # an optimistic insert can use the same id the server ends up persisting,
    # avoiding a row-key flicker when the response arrives.
    id: Optional[str] = None
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
    weight: float = 0
    clothing_size: Optional[str] = ""
    strong_foot: Optional[str] = ""
    mother_name: Optional[str] = ""
    mother_phone: Optional[str] = ""
    father_name: Optional[str] = ""
    father_phone: Optional[str] = ""
    attendance: int = 0
    is_trial: Optional[bool] = False
    home_club: Optional[str] = ""
    trial_rating: int = 0
    trial_notes: Optional[str] = ""

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
    # Optional client-supplied UUID so the frontend can do optimistic inserts
    # without a row-key flicker when the server response arrives.
    id: Optional[str] = None
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
    category: Optional[str] = ""
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
    drawing: Optional[str] = None

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
    series_id: Optional[str] = None
    is_modified: Optional[bool] = False
    class Config:
        orm_mode = True


# Recurring session series. Materialises into N TrainingSession rows on create.
class TrainingSeriesCreate(BaseModel):
    team_id: Optional[str] = None
    season_id: Optional[str] = None
    day_of_week: int               # 0 = Monday … 6 = Sunday
    series_start_date: str         # YYYY-MM-DD
    series_end_date: str           # YYYY-MM-DD
    start_time: str
    end_time: str
    focus: str
    intensity: str
    selected_players: str
    selected_exercises: str

class TrainingSeries(TrainingSeriesCreate):
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
    role: str = "coach"

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
#      CALENDAR EVENTS
# ==========================
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    date: str            # YYYY-MM-DD
    start_time: str
    end_time: str
    team_id: Optional[str] = None
    season_id: Optional[str] = None

class Event(EventCreate):
    id: str
    date: date
    class Config:
        orm_mode = True
        from_attributes = True

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

# ==========================
#     ADMIN (SUPERUSER)
# ==========================

class AdminFeedbackItem(FeedbackRequest):
    coach_email: str
    coach_name: Optional[str] = None

class AdminFeedbackStatusUpdate(BaseModel):
    status: str  # 'new' | 'in_progress' | 'resolved'

class AdminUnlockRequest(BaseModel):
    code: str

class AdminUnlockResponse(BaseModel):
    admin_token: str
    expires_in_minutes: int

class AdminUserItem(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str = "coach"
    is_verified: bool = False
    created_at: Optional[date] = None
    team_count: int = 0
    feedback_count: int = 0

# ==========================
#     GOOGLE CALENDAR
# ==========================
class GoogleConnectRequest(BaseModel):
    time_zone: Optional[str] = None

class GoogleAuthUrl(BaseModel):
    auth_url: str

class GoogleStatus(BaseModel):
    configured: bool
    connected: bool
    google_email: Optional[str] = None
    calendar_id: Optional[str] = None
    time_zone: Optional[str] = None
    push_enabled: bool = False
    last_synced_at: Optional[datetime] = None
    last_error: Optional[str] = None

class GoogleSyncResult(BaseModel):
    pulled: int = 0
    pushed: int = 0
    removed: int = 0

class AdminStats(BaseModel):
    users: int
    teams: int
    players: int
    training_sessions: int
    matches: int
    feedback_total: int
    feedback_new: int
    feedback_in_progress: int
    feedback_resolved: int