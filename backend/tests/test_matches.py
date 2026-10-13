from datetime import date, timedelta

import models


def test_rating_upsert_list_and_clear(make_coach):
    a = make_coach("a@x")
    player = a.player()
    match = a.match()
    url = f"/matches/{match['id']}/ratings/{player['id']}"

    assert a.put(url, json={"rating": 6}).status_code == 200
    assert a.put(url, json={"rating": 8}).json() == {"match_id": match["id"], "player_id": player["id"], "rating": 8}
    assert a.get(f"/matches/{match['id']}/ratings").json() == [{"match_id": match["id"], "player_id": player["id"], "rating": 8}]

    assert a.delete(url).status_code == 200
    assert a.get(f"/matches/{match['id']}/ratings").json() == []
    assert a.delete(url).status_code == 404


def test_rating_must_be_1_to_10(make_coach):
    a = make_coach("a@x")
    url = f"/matches/{a.match()['id']}/ratings/{a.player()['id']}"
    assert a.put(url, json={"rating": 0}).status_code == 422
    assert a.put(url, json={"rating": 11}).status_code == 422


def test_season_ratings_are_filtered_by_team_and_season(make_coach):
    a = make_coach("a@x")
    player = a.player()
    match = a.match()
    a.put(f"/matches/{match['id']}/ratings/{player['id']}", json={"rating": 7})
    assert len(a.get("/stats/ratings", params={"team_id": a.team["id"], "season_id": a.season["id"]}).json()) == 1
    assert a.get("/stats/ratings", params={"team_id": a.team["id"], "season_id": "other"}).json() == []


def test_ratings_are_isolated_between_coaches(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    a_player, a_match = a.player(), a.match()
    b_player, b_match = b.player("Other"), b.match()
    a.put(f"/matches/{a_match['id']}/ratings/{a_player['id']}", json={"rating": 7})

    assert b.get(f"/matches/{a_match['id']}/ratings").status_code == 404
    assert b.put(f"/matches/{a_match['id']}/ratings/{b_player['id']}", json={"rating": 5}).status_code == 404
    assert b.put(f"/matches/{b_match['id']}/ratings/{a_player['id']}", json={"rating": 5}).status_code == 404
    assert b.delete(f"/matches/{a_match['id']}/ratings/{a_player['id']}").status_code == 404
    assert b.get("/stats/ratings", params={"team_id": a.team["id"]}).status_code == 404


def test_top_performers_count_goals_and_assists(make_coach):
    a = make_coach("a@x")
    scorer, helper = a.player("Kraft", 9), a.player("Weber", 10)
    match = a.match()
    for pid, kind in ((scorer["id"], "Goal"), (scorer["id"], "Goal"), (helper["id"], "Assist")):
        a.post(f"/matches/{match['id']}/events", json={"player_id": pid, "event_type": kind, "minute": 30})
    top = a.get("/stats/top-performers", params={"team_id": a.team["id"]}).json()
    assert [(p["last_name"], p["goals"], p["assists"]) for p in top] == [("Kraft", 2, 0), ("Weber", 0, 1)]


def test_suggested_formation_default_and_from_training(make_coach, db):
    a = make_coach("a@x")
    assert a.get("/match/suggested-formation", params={"team_id": a.team["id"]}).json() == {
        "formation": "4-4-2", "kind": "default", "session_date": None, "exercise_name": None, "source": "Default"}

    db.add(models.Tactic(name="High Press", formation="4-3-3", coach_id=a.id))
    exercise = models.Exercise(name="Rondo 5v2", linked_tactics="High Press", coach_id=a.id)
    db.add(exercise)
    db.flush()
    day = date.today() - timedelta(days=2)
    db.add(models.TrainingSession(team_id=a.team["id"], date=day, selected_exercises=exercise.id))
    db.commit()

    res = a.get("/match/suggested-formation", params={"team_id": a.team["id"]}).json()
    assert {k: res[k] for k in ("formation", "kind", "session_date", "exercise_name")} == {
        "formation": "4-3-3", "kind": "training", "session_date": day.isoformat(), "exercise_name": "Rondo 5v2"}
