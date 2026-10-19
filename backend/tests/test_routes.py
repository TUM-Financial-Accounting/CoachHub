from datetime import date, timedelta

import models
import security


def test_match_stats_update(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    match = a.match()
    body = {"goals_for": 3, "goals_against": 1, "notes": "Good press"}
    assert b.put(f"/matches/{match['id']}/stats", json=body).status_code == 404
    res = a.put(f"/matches/{match['id']}/stats", json=body)
    assert res.status_code == 200
    stored = next(m for m in a.get("/matches").json() if m["id"] == match["id"])
    assert (stored["goals_for"], stored["goals_against"], stored["notes"]) == (3, 1, "Good press")


def test_match_event_delete(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    match = a.match()
    event = a.post(f"/matches/{match['id']}/events", json={"player_id": a.player()["id"], "event_type": "Goal", "minute": 5}).json()
    assert b.delete(f"/match_events/{event['id']}").status_code == 404
    assert a.delete(f"/match_events/{event['id']}").status_code == 200
    assert a.get(f"/matches/{match['id']}/events").json() == []


def test_latest_match_prefers_the_next_upcoming_one(make_coach):
    a = make_coach("a@x")
    params = {"team_id": a.team["id"]}
    assert a.get("/matches/latest", params=params).json() is None

    today = date.today()
    a.match(date=(today - timedelta(days=3)).isoformat(), opponent="Past FC")
    assert a.get("/matches/latest", params=params).json()["opponent"] == "Past FC"

    a.match(date=(today + timedelta(days=9)).isoformat(), opponent="Later FC")
    a.match(date=(today + timedelta(days=2)).isoformat(), opponent="Next FC")
    assert a.get("/matches/latest", params=params).json()["opponent"] == "Next FC"
    assert make_coach("b@x").get("/matches/latest", params=params).status_code == 404


def test_training_series_delete(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    series = a.post("/training_series", json={"weekdays": [0], "series_start_date": "2026-09-07", "occurrences": 3,
                                              "start_time": "1", "end_time": "2", "focus": "X", "intensity": "Low",
                                              "selected_players": "", "selected_exercises": "", **a.scoped()}).json()
    series_id = series["series"]["id"]
    assert b.delete(f"/training_series/{series_id}").status_code == 404
    assert a.delete(f"/training_series/{series_id}").status_code == 200
    assert a.get("/training_sessions").json() == []


def test_clone_team_into_another_season(make_coach):
    a = make_coach("a@x")
    player = a.player()
    next_season = a.post("/seasons", json={"name": "2027/28"}).json()
    assert a.post(f"/teams/{a.team['id']}/clone", params={"target_season_id": next_season["id"]}).status_code == 200

    clones = a.get("/teams", params={"season_id": next_season["id"]}).json()
    assert [t["name"] for t in clones] == [a.team["name"]]
    roster = a.get("/players", params={"team_id": clones[0]["id"], "season_id": next_season["id"]}).json()
    assert [p["id"] for p in roster] == [player["id"]]
    assert make_coach("b@x").post(f"/teams/{a.team['id']}/clone", params={"target_season_id": next_season["id"]}).status_code == 404


def test_upload_accepts_media_and_rejects_other_types(make_coach, client):
    a = make_coach("a@x")
    res = a.post("/upload", files={"file": ("photo.PNG", b"\x89PNG\r\n", "image/png")})
    assert res.status_code == 200
    url = res.json()["url"]
    assert url.startswith("/static/uploads/") and url.endswith(".png")
    assert client.get(url).content == b"\x89PNG\r\n"

    assert a.post("/upload", files={"file": ("page.html", b"<script>", "text/html")}).status_code == 400
    assert client.post("/upload", files={"file": ("photo.png", b"x", "image/png")}).status_code == 401


def test_visions_list_create_delete(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    vision = a.post("/visions", json={"title": "Club philosophy", "filename": "plan.pdf"}).json()
    assert [v["title"] for v in a.get("/visions").json()] == ["Club philosophy"]
    assert b.get("/visions").json() == []
    assert b.delete(f"/visions/{vision['id']}").status_code == 404
    assert a.delete(f"/visions/{vision['id']}").status_code == 200
    assert a.get("/visions").json() == []


def test_google_calendar_reports_not_configured(make_coach):
    a = make_coach("a@x")
    status = a.get("/google/status").json()
    assert (status["configured"], status["connected"]) == (False, False)
    assert a.post("/google/auth-url", json={"time_zone": "Europe/Berlin"}).status_code == 503
    assert a.post("/google/sync").status_code == 400
    assert a.delete("/google/disconnect").json()["connected"] is False


def test_google_webhook_ignores_unknown_channels(client):
    assert client.post("/google/webhook").json() == {"ok": True}
    headers = {"X-Goog-Channel-ID": "nope", "X-Goog-Channel-Token": "nope"}
    assert client.post("/google/webhook", headers=headers).json() == {"ok": True}


def test_admin_routes_need_a_superuser_and_an_unlock(make_coach, db):
    coach = make_coach("coach@x")
    assert coach.get("/admin/users").status_code == 404

    admin = make_coach("admin@x")
    db.get(models.User, admin.id).role = "superuser"
    db.commit()
    assert admin.get("/admin/users").status_code == 403
    assert admin.post("/admin/unlock", json={"code": "anything"}).status_code == 503

    admin.headers["X-Admin-Token"] = security.create_admin_token("admin@x")
    users = {u["email"]: u for u in admin.get("/admin/users").json()}
    assert users["coach@x"]["team_count"] == 1
    stats = admin.get("/admin/stats").json()
    assert (stats["users"], stats["teams"]) == (2, 2)
