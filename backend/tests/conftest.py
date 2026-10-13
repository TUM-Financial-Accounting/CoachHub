import os
import sys
import tempfile
import uuid

# Must run before importing main: load_dotenv() never overrides set variables, so backend/.env stays out.
_TMP = tempfile.mkdtemp(prefix="coachhub-tests-")
os.environ.update({
    "DATABASE_URL": f"sqlite:///{os.path.join(_TMP, 'test.db')}?check_same_thread=false",
    "SECRET_KEY": "test-secret",
    "UPLOAD_DIR": os.path.join(_TMP, "uploads"),
    "FRONTEND_URL": "http://localhost:5173",
    "GOOGLE_CLIENT_ID": "",
    "GOOGLE_CLIENT_SECRET": "",
    "RESEND_API_KEY": "",
    "SMTP_HOST": "",
    "ADMIN_ACCESS_CODE": "",
})
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event  # noqa: E402

import database  # noqa: E402

if database.engine.url.get_backend_name() != "sqlite":
    raise RuntimeError(f"Refusing to run tests against {database.engine.url.get_backend_name()}")


@event.listens_for(database.engine, "connect")
def _foreign_keys_on(dbapi_conn, _):
    # SQLite ignores FKs by default; the app relies on them failing loudly.
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


import main  # noqa: E402
import models  # noqa: E402
import security  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    database.engine.dispose()
    models.Base.metadata.drop_all(bind=database.engine)
    models.Base.metadata.create_all(bind=database.engine)
    yield


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def db():
    session = database.SessionLocal()
    yield session
    session.close()


class Coach:
    def __init__(self, client: TestClient, email: str):
        self.client = client
        session = database.SessionLocal()
        user = models.User(email=email, password=security.get_password_hash("pw"), full_name=email)
        session.add(user)
        session.commit()
        self.id = user.id
        session.close()
        self.headers = {"Authorization": f"Bearer {security.create_access_token({'sub': email})}"}
        self.season = self.post("/seasons", json={"name": "2026/27"}).json()
        self.team = self.post("/teams", json={"name": f"U15 {email}", "season_id": self.season["id"]}).json()

    def get(self, url, **kw):
        return self.client.get(url, headers=self.headers, **kw)

    def post(self, url, **kw):
        return self.client.post(url, headers=self.headers, **kw)

    def put(self, url, **kw):
        return self.client.put(url, headers=self.headers, **kw)

    def delete(self, url, **kw):
        return self.client.delete(url, headers=self.headers, **kw)

    def scoped(self, extra=None):
        return {"team_id": self.team["id"], "season_id": self.season["id"], **(extra or {})}

    def player(self, last_name="Kraft", jersey=9):
        # Client-minted id like the frontend: with a team_id, POST /players answers `{}`.
        body = {"id": str(uuid.uuid4()), "first_name": "Lena", "last_name": last_name, "date_of_birth": "2011-03-10",
                "position": "Forward", "jersey_number": jersey, "status": "Active", **self.scoped()}
        res = self.post("/players", json=body)
        assert res.status_code == 200, res.text
        return body

    def match(self, date="2026-09-05", **extra):
        body = {"opponent": "SV Nord", "date": date, "time": "11:00", "location": "Home", **self.scoped(extra)}
        res = self.post("/matches", json=body)
        assert res.status_code == 200, res.text
        return res.json()

    def session(self, date="2026-09-01"):
        body = {"date": date, "start_time": "17:00", "end_time": "18:30", "focus": "Pressing",
                "intensity": "Medium", "selected_players": "", "selected_exercises": "", **self.scoped()}
        res = self.post("/training_sessions", json=body)
        assert res.status_code == 200, res.text
        return res.json()

    def event(self, date="2026-09-20"):
        body = {"title": "Team dinner", "date": date, "start_time": "19:00", "end_time": "21:00", **self.scoped()}
        res = self.post("/events", json=body)
        assert res.status_code == 200, res.text
        return res.json()


@pytest.fixture
def make_coach(client):
    return lambda email: Coach(client, email)
