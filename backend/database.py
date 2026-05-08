from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Update this with your own PostgreSQL credentials before running.
# Format: postgresql://<user>:<password>@<host>/<database_name>
# SQLALCHEMY_DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost/football_db"
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://vincentclifford@localhost/football_db")

# 2. Remove connect_args={"check_same_thread": False}
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()