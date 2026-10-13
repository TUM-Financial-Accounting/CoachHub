import pytest

import main
import models


def test_owned_team_ids_and_require_owned_team(make_coach, db):
    a = make_coach("a@x")
    b = make_coach("b@x")
    user_a = db.get(models.User, a.id)
    user_b = db.get(models.User, b.id)

    assert main.owned_team_ids(db, user_a) == [a.team["id"]]
    assert main.require_owned_team(db, user_a, a.team["id"]).id == a.team["id"]
    for team_id in (b.team["id"], None, "missing"):
        with pytest.raises(main.HTTPException) as exc:
            main.require_owned_team(db, user_a, team_id)
        assert exc.value.status_code == 404
    assert main.owned_team_ids(db, user_b) == [b.team["id"]]


def test_requests_without_a_token_are_rejected(client):
    assert client.get("/matches").status_code == 401
    assert client.get("/matches", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_lists_never_include_another_coachs_rows(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    a.match()
    a.session()
    a.event()
    a.player()

    for path in ("/matches", "/training_sessions", "/events", "/players", "/teams", "/seasons"):
        res = b.get(path)
        assert res.status_code == 200, path
        own = {b.team["id"], b.season["id"]}
        assert all(row["id"] in own for row in res.json()), path

    for path in ("/matches", "/training_sessions"):
        assert b.get(path, params={"team_id": a.team["id"]}).status_code == 404, path


@pytest.mark.parametrize("kind", ["match", "session", "event", "player"])
def test_another_coachs_row_cannot_be_changed_or_deleted(make_coach, kind):
    a = make_coach("a@x")
    b = make_coach("b@x")
    row = getattr(a, kind)()
    path = {"match": "/matches", "session": "/training_sessions", "event": "/events", "player": "/players"}[kind]
    body = {
        "match": {"opponent": "X", "date": "2026-09-05", "time": "11:00", "location": "Away"},
        "session": {"date": "2026-09-01", "start_time": "1", "end_time": "2", "focus": "X", "intensity": "Low",
                    "selected_players": "", "selected_exercises": ""},
        "event": {"title": "X", "date": "2026-09-20", "start_time": "1", "end_time": "2"},
        "player": {"first_name": "X", "last_name": "Y", "date_of_birth": "", "position": "Forward",
                   "jersey_number": 1, "status": "Active"},
    }[kind]

    assert b.put(f"{path}/{row['id']}", json=body).status_code == 404
    assert b.delete(f"{path}/{row['id']}").status_code == 404
    assert any(r["id"] == row["id"] for r in a.get(path).json())


def test_another_coachs_team_and_season_are_off_limits(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    assert b.put(f"/teams/{a.team['id']}", json={"name": "Taken"}).status_code == 404
    assert b.delete(f"/teams/{a.team['id']}").status_code == 404
    assert b.delete(f"/seasons/{a.season['id']}").status_code == 404
    assert a.get("/teams").json()[0]["name"] == a.team["name"]


def test_writes_into_another_coachs_team_are_refused(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    foreign = {"team_id": a.team["id"]}
    assert b.post("/matches", json={"opponent": "X", "date": "2026-09-05", "time": "1", "location": "H", **foreign}).status_code == 404
    assert b.post("/training_sessions", json={"date": "2026-09-01", "start_time": "1", "end_time": "2", "focus": "X",
                                              "intensity": "Low", "selected_players": "", "selected_exercises": "", **foreign}).status_code == 404
    assert b.post("/events", json={"title": "X", "date": "2026-09-20", "start_time": "1", "end_time": "2", **foreign}).status_code == 404
    assert b.post("/training_series", json={"weekdays": [0], "series_start_date": "2026-09-07", "occurrences": 2,
                                            "start_time": "1", "end_time": "2", "focus": "X", "intensity": "Low",
                                            "selected_players": "", "selected_exercises": "", **foreign}).status_code == 404
    assert a.get("/matches").json() == []
