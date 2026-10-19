import models


def records(*rows):
    return {"records": [dict(zip(("player_id", "status", "reason"), r)) for r in rows]}


def test_save_and_read_attendance(make_coach):
    a = make_coach("a@x")
    p1, p2 = a.player("Kraft", 9)["id"], a.player("Weber", 10)["id"]
    session = a.session()
    url = f"/training_sessions/{session['id']}/attendance"

    assert a.get(url).json() == []
    saved = a.put(url, json=records((p1, "present", None), (p2, "absent", "injury")))
    assert saved.status_code == 200
    by_player = {r["player_id"]: r for r in a.get(url).json()}
    assert by_player[p1] == {"session_id": session["id"], "player_id": p1, "status": "present", "reason": None}
    assert by_player[p2]["reason"] == "injury"


def test_saving_replaces_the_previous_list(make_coach):
    a = make_coach("a@x")
    p1, p2 = a.player("Kraft", 9)["id"], a.player("Weber", 10)["id"]
    url = f"/training_sessions/{a.session()['id']}/attendance"
    a.put(url, json=records((p1, "present", None), (p2, "present", None)))
    a.put(url, json=records((p1, "absent", "school")))
    assert a.get(url).json() == [{"session_id": url.split("/")[2], "player_id": p1, "status": "absent", "reason": "school"}]
    a.put(url, json={"records": []})
    assert a.get(url).json() == []


def test_a_reason_is_dropped_for_present_players(make_coach):
    a = make_coach("a@x")
    p1 = a.player()["id"]
    url = f"/training_sessions/{a.session()['id']}/attendance"
    assert a.put(url, json=records((p1, "present", "illness"))).json()[0]["reason"] is None


def test_invalid_attendance_is_rejected(make_coach):
    a = make_coach("a@x")
    p1 = a.player()["id"]
    url = f"/training_sessions/{a.session()['id']}/attendance"
    assert a.put(url, json=records((p1, "late", None))).status_code == 422
    assert a.put(url, json=records((p1, "absent", "holiday"))).status_code == 422
    assert a.put(url, json=records((p1, "present", None), (p1, "absent", None))).status_code == 400


def test_attendance_is_isolated_between_coaches(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    a_player, b_player = a.player()["id"], b.player("Other")["id"]
    a_url = f"/training_sessions/{a.session()['id']}/attendance"
    b_url = f"/training_sessions/{b.session()['id']}/attendance"
    a.put(a_url, json=records((a_player, "present", None)))

    assert b.get(a_url).status_code == 404
    assert b.put(a_url, json=records((b_player, "present", None))).status_code == 404
    assert b.put(b_url, json=records((a_player, "present", None))).status_code == 404
    assert b.get("/stats/attendance", params={"team_id": a.team["id"]}).status_code == 404
    assert len(a.get(a_url).json()) == 1


def test_season_attendance_is_filtered_by_team_and_season(make_coach):
    a = make_coach("a@x")
    p1 = a.player()["id"]
    a.put(f"/training_sessions/{a.session()['id']}/attendance", json=records((p1, "present", None)))
    params = {"team_id": a.team["id"], "season_id": a.season["id"]}
    assert len(a.get("/stats/attendance", params=params).json()) == 1
    assert a.get("/stats/attendance", params={**params, "season_id": "other"}).json() == []


def test_attendance_goes_with_its_session_and_player(make_coach, db):
    a = make_coach("a@x")
    p1, p2 = a.player("Kraft", 9)["id"], a.player("Weber", 10)["id"]
    s1, s2 = a.session("2026-09-01")["id"], a.session("2026-09-08")["id"]
    for sid in (s1, s2):
        a.put(f"/training_sessions/{sid}/attendance", json=records((p1, "present", None), (p2, "absent", "illness")))

    assert a.delete(f"/training_sessions/{s1}").status_code == 200
    assert a.delete(f"/players/{p2}").status_code == 200
    db.expire_all()
    assert [(r.session_id, r.player_id) for r in db.query(models.TrainingAttendance).all()] == [(s2, p1)]

    assert a.delete(f"/teams/{a.team['id']}").status_code == 200
    db.expire_all()
    assert db.query(models.TrainingAttendance).count() == 0
