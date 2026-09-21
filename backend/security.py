import os
import secrets as _secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

# --- CONFIGURATION ---
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 4 # 4 hours

# --- ADMIN STEP-UP ---
ADMIN_UNLOCK_EXPIRE_MINUTES = 30
ADMIN_TOKEN_SCOPE = "admin"


def admin_code_configured() -> bool:
    # An unset code keeps the admin area locked rather than open.
    return bool((os.environ.get("ADMIN_ACCESS_CODE") or "").strip())


def verify_admin_code(candidate: str) -> bool:
    expected = (os.environ.get("ADMIN_ACCESS_CODE") or "").strip()
    if not expected:
        return False
    # Constant-time: == leaks the matching prefix length through timing.
    return _secrets.compare_digest((candidate or "").strip(), expected)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory token blacklist (use Redis if running multiple workers)
_blacklisted_tokens: set[str] = set()

def blacklist_token(token: str):
    _blacklisted_tokens.add(token)

def is_token_blacklisted(token: str) -> bool:
    return token in _blacklisted_tokens

# --- PASSWORD HASHING ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# --- JWT TOKENS ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_admin_token(email: str) -> str:
    # The scope claim stops an ordinary login token standing in for it.
    return create_access_token(
        {"sub": email, "scope": ADMIN_TOKEN_SCOPE},
        expires_delta=timedelta(minutes=ADMIN_UNLOCK_EXPIRE_MINUTES),
    )


def decode_admin_token(token: str, email: str):
    payload = decode_access_token(token)
    if not payload:
        return None
    if payload.get("scope") != ADMIN_TOKEN_SCOPE:
        return None
    if payload.get("sub") != email:
        return None
    return payload


def decode_access_token(token: str):
    if is_token_blacklisted(token):
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
