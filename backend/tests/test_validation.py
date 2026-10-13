def test_feedback_type_must_be_known(make_coach):
    a = make_coach("a@x")
    body = {"title": "T", "description": "D"}
    assert a.post("/feedback", json={**body, "type": "rant"}).status_code == 422
    created = a.post("/feedback", json={**body, "type": "bug"})
    assert created.status_code == 200 and created.json()["status"] == "new"


def test_blank_feedback_is_still_rejected(make_coach):
    a = make_coach("a@x")
    assert a.post("/feedback", json={"type": "bug", "title": " ", "description": "D"}).status_code == 400


def test_match_event_type_must_be_goal_or_assist(make_coach):
    a = make_coach("a@x")
    url = f"/matches/{a.match()['id']}/events"
    player_id = a.player()["id"]
    assert a.post(url, json={"player_id": player_id, "event_type": "Own goal"}).status_code == 422
    assert a.post(url, json={"player_id": player_id, "event_type": "Goal"}).status_code == 200


def test_series_scope_must_be_known(make_coach):
    a = make_coach("a@x")
    session_id = a.session()["id"]
    assert a.delete(f"/training_sessions/{session_id}", params={"scope": "everything"}).status_code == 422
    event_id = a.event()["id"]
    assert a.delete(f"/events/{event_id}", params={"scope": "everything"}).status_code == 422


def test_performance_update_requires_a_team(make_coach):
    a = make_coach("a@x")
    player_id = a.player()["id"]
    assert a.put(f"/players/{player_id}/performance", json={"performance": 7}).status_code == 422
    assert a.put(f"/players/{player_id}/performance", json={"performance": 7, "team_id": a.team["id"]}).status_code == 200


def test_legacy_day_of_week_is_range_checked(make_coach):
    a = make_coach("a@x")
    body = {"day_of_week": 9, "series_start_date": "2026-09-07", "occurrences": 2, "start_time": "1", "end_time": "2",
            "focus": "X", "intensity": "Low", "selected_players": "", "selected_exercises": "", **a.scoped()}
    assert a.post("/training_series", json=body).status_code == 422
