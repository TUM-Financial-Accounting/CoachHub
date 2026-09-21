import base64
import hashlib
import json
import os
import secrets as _secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

import database
import models
import security

AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URI = "https://oauth2.googleapis.com/token"
REVOKE_URI = "https://oauth2.googleapis.com/revoke"
API = "https://www.googleapis.com/calendar/v3"

# Least privilege; widen to "https://www.googleapis.com/auth/calendar" if Google refuses a call.
SCOPE = "https://www.googleapis.com/auth/calendar.app.created"

STATE_SCOPE = "google_oauth"
STATE_TTL_MINUTES = 10
CHANNEL_TTL_DAYS = 30
CHANNEL_RENEW_WITHIN_DAYS = 3
MATCH_DURATION_MIN = 120
DEFAULT_MATCH_TIME = "15:00"
CALENDAR_NAME = "CoachHub"

KIND_TRAINING = "t"
KIND_MATCH = "m"
KIND_EVENT = "e"


class GoogleError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def client_id() -> str:
    return (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()


def client_secret() -> str:
    return (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()


def is_configured() -> bool:
    return bool(client_id() and client_secret())


def backend_url() -> str:
    return (os.environ.get("BACKEND_PUBLIC_URL") or "http://localhost:8000").strip().rstrip("/")


def redirect_uri() -> str:
    return f"{backend_url()}/auth/google/callback"


def webhook_url() -> Optional[str]:
    url = backend_url()
    # Google only delivers push notifications to public HTTPS endpoints.
    return f"{url}/google/webhook" if url.startswith("https://") else None


def _fernet() -> Fernet:
    digest = hashlib.sha256(security.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def _request(method: str, url: str, *, token: Optional[str] = None, body=None, form=None) -> dict:
    headers = {"Accept": "application/json", "User-Agent": "CoachHub/1.0"}
    data = None
    if form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        message = raw
        try:
            error = json.loads(raw).get("error")
            if isinstance(error, dict):
                message = error.get("message") or raw
            elif isinstance(error, str):
                message = error
        except ValueError:
            pass
        raise GoogleError(f"Google API {exc.code}: {message[:300]}", status=exc.code)
    except Exception as exc:
        raise GoogleError(f"Could not reach Google: {exc}")


def build_auth_url(state: str) -> str:
    params = {
        "client_id": client_id(),
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "include_granted_scopes": "true",
        # Forces a refresh token even when the coach already granted access once.
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTH_URI}?{urllib.parse.urlencode(params)}"


def make_state(email: str, time_zone: str) -> str:
    return security.create_access_token(
        {"sub": email, "scope": STATE_SCOPE, "tz": time_zone},
        expires_delta=timedelta(minutes=STATE_TTL_MINUTES),
    )


def read_state(state: str) -> Optional[dict]:
    payload = security.decode_access_token(state)
    if not payload or payload.get("scope") != STATE_SCOPE:
        return None
    return payload


def exchange_code(code: str) -> dict:
    return _request("POST", TOKEN_URI, form={
        "code": code,
        "client_id": client_id(),
        "client_secret": client_secret(),
        "redirect_uri": redirect_uri(),
        "grant_type": "authorization_code",
    })


def refresh_access_token(refresh_token: str) -> dict:
    return _request("POST", TOKEN_URI, form={
        "refresh_token": refresh_token,
        "client_id": client_id(),
        "client_secret": client_secret(),
        "grant_type": "refresh_token",
    })


def revoke(token: str) -> None:
    try:
        _request("POST", REVOKE_URI, form={"token": token})
    except GoogleError:
        pass


def userinfo_email(access_token: str) -> str:
    try:
        data = _request("GET", "https://www.googleapis.com/oauth2/v2/userinfo", token=access_token)
        return data.get("email") or ""
    except GoogleError:
        return ""


def access_token_for(db: Session, account: models.GoogleAccount) -> str:
    now = datetime.utcnow()
    token = decrypt(account.access_token)
    if token and account.token_expires_at and account.token_expires_at > now + timedelta(seconds=60):
        return token

    refresh = decrypt(account.refresh_token)
    if not refresh:
        raise GoogleError("Google account needs to be reconnected", status=401)
    data = refresh_access_token(refresh)
    token = data.get("access_token")
    if not token:
        raise GoogleError("Google did not return an access token", status=401)
    account.access_token = encrypt(token)
    account.token_expires_at = now + timedelta(seconds=int(data.get("expires_in", 3600)))
    db.commit()
    return token


_B32HEX = set("0123456789abcdefghijklmnopqrstuv")


def event_id(kind: str, row_id: str) -> Optional[str]:
    # UUID hex digits are valid base32hex, so a row maps to its Google event id without a table.
    compact = (row_id or "").replace("-", "").lower()
    if len(compact) < 4 or any(c not in _B32HEX for c in compact):
        return None
    return kind + compact


def decode_event_id(gid: str) -> Optional[tuple]:
    if not gid or len(gid) != 33 or gid[0] not in (KIND_TRAINING, KIND_MATCH, KIND_EVENT):
        return None
    h = gid[1:]
    if any(c not in "0123456789abcdef" for c in h):
        return None
    return gid[0], f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def ensure_calendar(db: Session, account: models.GoogleAccount, token: str) -> str:
    if account.calendar_id:
        return account.calendar_id
    created = _request("POST", f"{API}/calendars", token=token, body={
        "summary": CALENDAR_NAME,
        "description": "Trainings, matches and events from CoachHub.",
        "timeZone": account.time_zone or "UTC",
    })
    account.calendar_id = created.get("id")
    db.commit()
    if not account.calendar_id:
        raise GoogleError("Google did not return a calendar id")
    return account.calendar_id


def _minutes(hhmm: str) -> Optional[int]:
    try:
        h, m = (hhmm or "").split(":")[:2]
        h, m = int(h), int(m)
    except (ValueError, TypeError):
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return None
    return h * 60 + m


def _clock(total: int) -> str:
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


def _times(day, start: str, end: str, fallback_start: Optional[str] = None, duration: int = 60):
    s = _minutes(start) if start else None
    if s is None and fallback_start:
        s = _minutes(fallback_start)
    if s is None:
        return None, None
    e = _minutes(end) if end else None
    if e is None or e <= s:
        e = min(s + duration, 24 * 60 - 1)
    return f"{day.isoformat()}T{_clock(s)}:00", f"{day.isoformat()}T{_clock(e)}:00"


def _body(summary: str, day, start_iso, end_iso, tz: str, description: str = "", location: str = "") -> dict:
    when = (
        {"start": {"dateTime": start_iso, "timeZone": tz}, "end": {"dateTime": end_iso, "timeZone": tz}}
        if start_iso else
        {"start": {"date": day.isoformat()}, "end": {"date": (day + timedelta(days=1)).isoformat()}}
    )
    return {"summary": summary, "description": description or "", "location": location or "", **when}


def _team_names(db: Session, coach_id: str) -> dict:
    rows = db.query(models.Team.id, models.Team.name).filter(models.Team.coach_id == coach_id).all()
    return {r[0]: r[1] for r in rows}


def _prefix(names: dict, team_id) -> str:
    name = names.get(team_id)
    return f"{name} · " if name else ""


def collect_items(db: Session, coach_id: str) -> tuple:
    names = _team_names(db, coach_id)
    team_ids = list(names.keys())
    out = {}

    sessions = db.query(models.TrainingSession).filter(models.TrainingSession.team_id.in_(team_ids)).all() if team_ids else []
    for s in sessions:
        gid = event_id(KIND_TRAINING, s.id)
        if gid and s.date:
            out[gid] = ("training", s)

    matches = db.query(models.Match).filter(models.Match.team_id.in_(team_ids)).all() if team_ids else []
    for m in matches:
        gid = event_id(KIND_MATCH, m.id)
        if gid and m.date:
            out[gid] = ("match", m)

    for e in db.query(models.Event).filter(models.Event.coach_id == coach_id).all():
        gid = event_id(KIND_EVENT, e.id)
        if gid and e.date:
            out[gid] = ("event", e)

    return out, names


def item_body(kind: str, row, names: dict, tz: str) -> dict:
    if kind == "training":
        start, end = _times(row.date, row.start_time, row.end_time, duration=90)
        title = f"{_prefix(names, row.team_id)}{row.focus or 'Training'}"
        return _body(title, row.date, start, end, tz, description=f"Intensity: {row.intensity or '-'}")
    if kind == "match":
        start, end = _times(row.date, row.time, None, fallback_start=DEFAULT_MATCH_TIME, duration=MATCH_DURATION_MIN)
        title = f"{_prefix(names, row.team_id)}vs {row.opponent or '-'}"
        return _body(title, row.date, start, end, tz, location=row.location or "")
    start, end = _times(row.date, row.start_time, row.end_time)
    return _body(f"{_prefix(names, row.team_id)}{row.title or 'Event'}", row.date, start, end, tz,
                 description=row.description or "", location=row.location or "")


def _same(existing: dict, desired: dict) -> bool:
    if (existing.get("summary") or "") != (desired.get("summary") or ""):
        return False
    if (existing.get("location") or "") != (desired.get("location") or ""):
        return False
    if (existing.get("description") or "") != (desired.get("description") or ""):
        return False
    for side in ("start", "end"):
        a, b = existing.get(side) or {}, desired.get(side) or {}
        if a.get("date") != b.get("date"):
            return False
        # Google echoes an offset; compare only the wall-clock part we sent.
        if (a.get("dateTime") or "")[:19] != (b.get("dateTime") or "")[:19]:
            return False
    return True


def list_events(token: str, calendar_id: str) -> list:
    out, page = [], None
    while True:
        params = {"maxResults": "2500", "showDeleted": "false", "singleEvents": "true"}
        if page:
            params["pageToken"] = page
        data = _request("GET", f"{API}/calendars/{urllib.parse.quote(calendar_id)}/events?{urllib.parse.urlencode(params)}", token=token)
        out.extend(data.get("items", []))
        page = data.get("nextPageToken")
        if not page:
            return out


def _google_local(part: dict):
    if part.get("date"):
        try:
            return datetime.strptime(part["date"], "%Y-%m-%d").date(), None
        except ValueError:
            return None, None
    raw = part.get("dateTime")
    if not raw or len(raw) < 16:
        return None, None
    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").date(), raw[11:16]
    except ValueError:
        return None, None


def pull_times(db: Session, coach_id: str, events: list, items: dict) -> int:
    changed = 0
    for ev in events:
        entry = items.get(ev.get("id"))
        if not entry:
            continue
        kind, row = entry
        day, start = _google_local(ev.get("start") or {})
        _, end = _google_local(ev.get("end") or {})
        if not day:
            continue
        touched = False
        if row.date != day:
            row.date = day
            touched = True
        if start:
            if kind == "match":
                if (row.time or "") != start:
                    row.time = start
                    touched = True
            else:
                if (row.start_time or "") != start:
                    row.start_time = start
                    touched = True
                if end and (row.end_time or "") != end:
                    row.end_time = end
                    touched = True
        if touched:
            changed += 1
    if changed:
        db.commit()
    return changed


def _put_or_insert(token: str, calendar_id: str, gid: str, body: dict) -> None:
    cal = urllib.parse.quote(calendar_id)
    payload = dict(body, id=gid)
    try:
        _request("PUT", f"{API}/calendars/{cal}/events/{gid}", token=token, body=payload)
    except GoogleError as exc:
        if exc.status not in (404, 410):
            raise
        try:
            _request("POST", f"{API}/calendars/{cal}/events", token=token, body=payload)
        except GoogleError as inner:
            # 409 means the id exists in a deleted state; PATCH revives it.
            if inner.status != 409:
                raise
            _request("PATCH", f"{API}/calendars/{cal}/events/{gid}", token=token, body=dict(body, status="confirmed"))


def push_all(db: Session, coach_id: str, token: str, calendar_id: str, items: dict, names: dict, tz: str, existing: dict) -> dict:
    written = removed = 0
    for gid, (kind, row) in items.items():
        body = item_body(kind, row, names, tz)
        current = existing.get(gid)
        if current and _same(current, body):
            continue
        _put_or_insert(token, calendar_id, gid, body)
        written += 1

    cal = urllib.parse.quote(calendar_id)
    for gid in existing:
        if gid in items or not decode_event_id(gid):
            continue
        try:
            _request("DELETE", f"{API}/calendars/{cal}/events/{gid}", token=token)
            removed += 1
        except GoogleError as exc:
            if exc.status not in (404, 410):
                raise
    return {"written": written, "removed": removed}


def ensure_watch(db: Session, account: models.GoogleAccount, token: str) -> None:
    url = webhook_url()
    if not url:
        return
    now = datetime.utcnow()
    if account.channel_expires_at and account.channel_expires_at > now + timedelta(days=CHANNEL_RENEW_WITHIN_DAYS):
        return
    channel_id = _secrets.token_urlsafe(16)
    channel_token = _secrets.token_urlsafe(24)
    expiry_ms = int((now + timedelta(days=CHANNEL_TTL_DAYS)).timestamp() * 1000)
    try:
        result = _request(
            "POST",
            f"{API}/calendars/{urllib.parse.quote(account.calendar_id)}/events/watch",
            token=token,
            body={"id": channel_id, "type": "web_hook", "address": url, "token": channel_token, "expiration": expiry_ms},
        )
    except GoogleError:
        # Push is a nicety; manual and on-write sync still work without it.
        return
    account.channel_id = channel_id
    account.channel_token = channel_token
    account.channel_resource_id = result.get("resourceId")
    raw_expiry = result.get("expiration")
    account.channel_expires_at = (
        datetime.utcfromtimestamp(int(raw_expiry) / 1000) if raw_expiry else now + timedelta(days=CHANNEL_TTL_DAYS)
    )
    db.commit()


def stop_watch(account: models.GoogleAccount, token: str) -> None:
    if not account.channel_id or not account.channel_resource_id:
        return
    try:
        _request("POST", f"{API}/channels/stop", token=token,
                 body={"id": account.channel_id, "resourceId": account.channel_resource_id})
    except GoogleError:
        pass


def sync(db: Session, account: models.GoogleAccount) -> dict:
    token = access_token_for(db, account)
    calendar_id = ensure_calendar(db, account, token)
    tz = account.time_zone or "UTC"

    items, names = collect_items(db, account.coach_id)
    events = list_events(token, calendar_id)
    existing = {e["id"]: e for e in events if e.get("id")}

    pulled = pull_times(db, account.coach_id, events, items)
    # collect again so the push sees the rows the pull just moved
    items, names = collect_items(db, account.coach_id)
    pushed = push_all(db, account.coach_id, token, calendar_id, items, names, tz, existing)

    ensure_watch(db, account, token)
    account.last_synced_at = datetime.utcnow()
    account.last_error = None
    db.commit()
    return {"pulled": pulled, "pushed": pushed["written"], "removed": pushed["removed"]}


def _account(db: Session, coach_id: str) -> Optional[models.GoogleAccount]:
    if not is_configured():
        return None
    return db.query(models.GoogleAccount).filter(models.GoogleAccount.coach_id == coach_id).first()


def _remember_failure(db: Session, coach_id: str, exc: Exception) -> None:
    # Runs after the response has gone out, so it must never raise.
    try:
        db.rollback()
        account = _account(db, coach_id)
        if account:
            account.last_error = str(exc)[:500]
            db.commit()
    except Exception:
        db.rollback()


def push_item(coach_id: str, kind: str, item_id: str) -> None:
    db = database.SessionLocal()
    try:
        account = _account(db, coach_id)
        if not account:
            return
        gid = event_id({"training": KIND_TRAINING, "match": KIND_MATCH, "event": KIND_EVENT}[kind], item_id)
        if not gid:
            return
        token = access_token_for(db, account)
        calendar_id = ensure_calendar(db, account, token)
        model = {"training": models.TrainingSession, "match": models.Match, "event": models.Event}[kind]
        row = db.query(model).filter(model.id == item_id).first()
        if row is None or not row.date:
            _request("DELETE", f"{API}/calendars/{urllib.parse.quote(calendar_id)}/events/{gid}", token=token)
            return
        names = _team_names(db, coach_id)
        _put_or_insert(token, calendar_id, gid, item_body(kind, row, names, account.time_zone or "UTC"))
        account.last_error = None
        db.commit()
    except GoogleError as exc:
        if getattr(exc, "status", 0) not in (404, 410):
            _remember_failure(db, coach_id, exc)
    except Exception as exc:
        _remember_failure(db, coach_id, exc)
    finally:
        db.close()


def delete_item(coach_id: str, kind: str, item_id: str) -> None:
    db = database.SessionLocal()
    try:
        account = _account(db, coach_id)
        if not account or not account.calendar_id:
            return
        gid = event_id({"training": KIND_TRAINING, "match": KIND_MATCH, "event": KIND_EVENT}[kind], item_id)
        if not gid:
            return
        token = access_token_for(db, account)
        _request("DELETE", f"{API}/calendars/{urllib.parse.quote(account.calendar_id)}/events/{gid}", token=token)
    except Exception:
        pass
    finally:
        db.close()


def sync_in_background(coach_id: str) -> None:
    db = database.SessionLocal()
    try:
        account = _account(db, coach_id)
        if account:
            sync(db, account)
    except Exception as exc:
        _remember_failure(db, coach_id, exc)
    finally:
        db.close()
