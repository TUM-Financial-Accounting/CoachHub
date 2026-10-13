from sqlalchemy import Column, String, Integer, Float, Text, Boolean, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base
from constants import DEFAULT_FORMATION, FEEDBACK_STATUS_NEW, ROLE_COACH
import uuid
import datetime
from sqlalchemy import DateTime


def utcnow() -> datetime.datetime:
    """Naive UTC, matching the naive DateTime columns (datetime.utcnow() is deprecated)."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


class TeamPlayer(Base):
    __tablename__ = 'team_players'
    team_id = Column(String, ForeignKey('teams.id'), primary_key=True)
    player_id = Column(String, ForeignKey('players.id'), primary_key=True)
    season_id = Column(String, ForeignKey('seasons.id'), primary_key=True, default='default-season')
    performance = Column(Integer, default=0)
    
    # Helper relationships to reach from assignment
    player = relationship("Player", back_populates="team_assignments")
    team = relationship("Team", back_populates="player_assignments")

def generate_uuid():
    return str(uuid.uuid4())

# --- 1. AUTH & TEAMS & SEASONS ---
class Season(Base):
    __tablename__ = "seasons"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String) 
    created_at = Column(Date, default=datetime.date.today)

class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    formation = Column(String) 
    season_id = Column(String, ForeignKey("seasons.id"), nullable=True)
    created_at = Column(Date, default=datetime.date.today)
    
    player_assignments = relationship("TeamPlayer", back_populates="team", cascade="all, delete-orphan")

class Player(Base):
    __tablename__ = "players"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    team_assignments = relationship("TeamPlayer", back_populates="player", cascade="all, delete-orphan")
    teams = relationship("Team", secondary="team_players", viewonly=True, backref="players_view")
    
    first_name = Column(String)
    last_name = Column(String)
    date_of_birth = Column(String) 
    position = Column(String) 
    jersey_number = Column(Integer)
    status = Column(String, default="Active")
    
    # Contact & Personal
    player_phone = Column(String, nullable=True)
    
    # CHANGED: String -> Text (Crucial for Base64 images)
    image_url = Column(Text, nullable=True) 
    
    # Physical
    height = Column(Integer, default=0)
    weight = Column(Float, default=0)
    clothing_size = Column(String, nullable=True)  # free text: XS/S/M/L/XL/XXL or kid sizes
    strong_foot = Column(String, nullable=True)    # 'Left' | 'Right' | 'Both'
    
    # Parents
    mother_name = Column(String, nullable=True)
    mother_phone = Column(String, nullable=True)
    father_name = Column(String, nullable=True)
    father_phone = Column(String, nullable=True)
    
    # Stats
    attendance = Column(Integer, default=0)

    # Trial players ("Probespieler"). Created like regular players but not
    # part of any squad until promoted; tracked with their current club and
    # a short scouting evaluation.
    is_trial = Column(Boolean, default=False)
    home_club = Column(String, nullable=True)
    trial_rating = Column(Integer, default=0)  # 0 = unrated, 1-5 stars
    trial_notes = Column(Text, nullable=True)

# --- 2. LIBRARIES ---
class Basic(Base):
    __tablename__ = "basics"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    description = Column(Text)
    
    # CHANGED: String -> Text
    diagram_url = Column(Text, nullable=True) 

class Principle(Base):
    __tablename__ = "principles"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    game_phase = Column(String)
    description = Column(Text)
    coaching_notes = Column(Text, nullable=True)      
    implementation_tips = Column(Text, nullable=True) 
    
    # CHANGED: String -> Text
    media_url = Column(Text, nullable=True)  

class Tactic(Base):
    __tablename__ = "tactics"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    formation = Column(String)
    description = Column(Text)
    
    # CHANGED: String -> Text
    diagram_url = Column(Text, nullable=True)       
    
    suggested_drills = Column(Text, nullable=True)    

# --- 3. EXERCISES ---
class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    # Training focus / type of drill: technique, tactical, athletic, game form, etc.
    # Stored as a canonical string (see EXERCISE_CATEGORIES on the frontend);
    # nullable so exercises created before this field keep working.
    category = Column(String, nullable=True)
    intensity = Column(String)
    description = Column(Text)
    setup = Column(Text, nullable=True)
    variations = Column(Text, nullable=True)
    coaching_points = Column(Text, nullable=True)
    goalkeepers = Column(Integer, default=0) 
    equipment = Column(Text, nullable=True) 
    
    # CHANGED: String -> Text
    media_url = Column(Text, nullable=True)
    # Hand-drawn diagram (JSON); used when no media_url picture exists.
    drawing = Column(Text, nullable=True)

    linked_basics = Column(Text, nullable=True)
    linked_principles = Column(Text, nullable=True)
    linked_tactics = Column(Text, nullable=True)

class TrainingSession(Base):
    __tablename__ = "training_sessions"
    id = Column(String, primary_key=True, default=generate_uuid)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=True)
    date = Column(Date)
    start_time = Column(String)
    end_time = Column(String)
    focus = Column(String)
    intensity = Column(String)

    selected_players = Column(Text)
    selected_exercises = Column(Text)

    # Recurring-series link. NULL for one-off sessions. When the user edits an
    # occurrence with scope="this only" we flip is_modified so subsequent
    # "edit this and future" changes skip over the customised row.
    series_id = Column(String, ForeignKey("training_series.id"), nullable=True)
    is_modified = Column(Boolean, default=False)


class TrainingSeries(Base):
    __tablename__ = "training_series"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=True)

    # Recurrence pattern (see recurrence.expand). Stored alongside the
    # template fields below so "edit this and all future" can propagate the
    # new template to remaining unmodified occurrences.
    day_of_week = Column(Integer)  # 0 = Monday … 6 = Sunday; first of `weekdays`, kept for older rows
    frequency = Column(String, default="weekly")  # weekly | biweekly | monthly
    weekdays = Column(String, nullable=True)  # comma-separated 0..6; NULL on older rows means [day_of_week]
    series_start_date = Column(Date)
    series_end_date = Column(Date)

    start_time = Column(String)
    end_time = Column(String)
    focus = Column(String)
    intensity = Column(String)
    selected_players = Column(Text)
    selected_exercises = Column(Text)


class Match(Base):
    __tablename__ = "matches"
    id = Column(String, primary_key=True, default=generate_uuid)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=True)
    opponent = Column(String)
    date = Column(Date)
    time = Column(String)
    location = Column(String)
    formation = Column(String, default=DEFAULT_FORMATION)
    
    lineup = Column(Text, nullable=True)
    goals_for = Column(Integer, default=0)
    goals_against = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    
    events = relationship("MatchEvent", back_populates="match", cascade="all, delete-orphan")
    ratings = relationship("MatchRating", back_populates="match", cascade="all, delete-orphan")

class MatchEvent(Base):
    __tablename__ = "match_events"
    id = Column(String, primary_key=True, default=generate_uuid)
    match_id = Column(String, ForeignKey("matches.id"), nullable=False)
    player_id = Column(String, ForeignKey("players.id"), nullable=False)
    event_type = Column(String)  # EVENT_GOAL | EVENT_ASSIST
    minute = Column(Integer, nullable=True)
    
    match = relationship("Match", back_populates="events")
    player = relationship("Player")

class MatchRating(Base):
    # Per-match coach rating. Separate from TeamPlayer.performance, which is the season rating.
    __tablename__ = "match_ratings"
    match_id = Column(String, ForeignKey("matches.id"), primary_key=True)
    player_id = Column(String, ForeignKey("players.id"), primary_key=True)
    rating = Column(Integer, nullable=False)  # 1-10; unrated = no row

    match = relationship("Match", back_populates="ratings")



# --- 3.5. CUSTOM FORMATIONS ---
class CustomFormation(Base):
    __tablename__ = "custom_formations"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    positions = Column(Text) # JSON string of PositionSlot array

# --- 4. VISION ---
class Vision(Base):
    __tablename__ = "visions"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String)
    filename = Column(String)
    uploaded_at = Column(DateTime, default=datetime.datetime.now)

# --- 1. AUTH & TEAMS --- 
class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    password = Column(String) 
    full_name = Column(String, nullable=True)
    created_at = Column(Date, default=datetime.date.today)
    # Assigned only via create_superuser.py, never through the API.
    role = Column(String, nullable=False, default=ROLE_COACH, server_default=ROLE_COACH)

    # Password Reset
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

    # Email Verification
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    verification_token_expires = Column(DateTime, nullable=True)


# --- CALENDAR EVENTS ---
# Generic team events (meetings, team-building, etc.) shown on the calendar
# alongside training sessions and matches, which keep their own richer models.
class Event(Base):
    __tablename__ = "events"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    date = Column(Date)
    start_time = Column(String)
    end_time = Column(String)
    created_at = Column(DateTime, default=utcnow)
    series_id = Column(String, ForeignKey("event_series.id"), nullable=True)


class EventSeries(Base):
    __tablename__ = "event_series"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=True)
    frequency = Column(String, default="weekly")
    weekdays = Column(String)
    series_start_date = Column(Date)
    series_end_date = Column(Date)
    title = Column(String)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    start_time = Column(String)
    end_time = Column(String)


# --- GOOGLE CALENDAR ---
# Tokens are encrypted with a key derived from SECRET_KEY.
class GoogleAccount(Base):
    __tablename__ = "google_accounts"
    coach_id = Column(String, ForeignKey("users.id"), primary_key=True)
    google_email = Column(String, nullable=True)
    refresh_token = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    calendar_id = Column(String, nullable=True)
    time_zone = Column(String, nullable=True)

    channel_id = Column(String, nullable=True)
    channel_token = Column(String, nullable=True)
    channel_resource_id = Column(String, nullable=True)
    channel_expires_at = Column(DateTime, nullable=True)

    last_synced_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)


# --- FEEDBACK ---
class FeedbackRequest(Base):
    __tablename__ = "feedback_requests"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String)            # 'bug' | 'feature' | 'question'
    title = Column(String)
    description = Column(Text)
    screenshot_urls = Column(JSON, nullable=True)
    status = Column(String, default=FEEDBACK_STATUS_NEW)  # one of FEEDBACK_STATUSES
    created_at = Column(DateTime, default=utcnow)