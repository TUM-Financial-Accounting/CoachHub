from sqlalchemy import Column, String, Integer, Text, Boolean, Date, Time, ForeignKey, Table
from sqlalchemy.orm import relationship
from database import Base
import uuid
import datetime 
from sqlalchemy import DateTime

class TeamPlayer(Base):
    __tablename__ = 'team_players'
    team_id = Column(String, ForeignKey('teams.id'), primary_key=True)
    player_id = Column(String, ForeignKey('players.id'), primary_key=True)
    performance = Column(Integer, default=0)
    
    # Helper relationships to reach from assignment
    player = relationship("Player", back_populates="team_assignments")
    team = relationship("Team", back_populates="player_assignments")

def generate_uuid():
    return str(uuid.uuid4())

# --- 1. AUTH & TEAMS ---
class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True, default=generate_uuid)
    coach_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    formation = Column(String) 
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
    weight = Column(Integer, default=0) 
    
    # Parents
    mother_name = Column(String, nullable=True)
    mother_phone = Column(String, nullable=True)
    father_name = Column(String, nullable=True)
    father_phone = Column(String, nullable=True)
    
    # Stats
    attendance = Column(Integer, default=0)
    
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
    intensity = Column(String)
    description = Column(Text)
    setup = Column(Text, nullable=True)
    variations = Column(Text, nullable=True)
    coaching_points = Column(Text, nullable=True)
    goalkeepers = Column(Integer, default=0) 
    equipment = Column(Text, nullable=True) 
    
    # CHANGED: String -> Text
    media_url = Column(Text, nullable=True)
    
    linked_basics = Column(Text, nullable=True)
    linked_principles = Column(Text, nullable=True)
    linked_tactics = Column(Text, nullable=True)

class TrainingSession(Base):
    __tablename__ = "training_sessions"
    id = Column(String, primary_key=True, default=generate_uuid)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    date = Column(Date)
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
    opponent = Column(String)
    date = Column(Date)
    time = Column(String)
    location = Column(String)
    formation = Column(String, default="4-4-2")
    
    lineup = Column(Text, nullable=True)



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

    # Password Reset
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)