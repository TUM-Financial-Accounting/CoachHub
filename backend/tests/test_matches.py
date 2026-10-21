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


def test_new_match_has_no_result_until_stats_are_saved(make_coach):
    a = make_coach("a@x")
    match = a.match()
    assert (match["goals_for"], match["goals_against"]) == (None, None)

    a.put(f"/matches/{match['id']}/stats", json={"goals_for": 0, "goals_against": 0})
    stored = next(m for m in a.get("/matches", params=a.scoped()).json() if m["id"] == match["id"])
    assert (stored["goals_for"], stored["goals_against"]) == (0, 0)


def test_clear_placeholder_scores_keeps_documented_matches(make_coach, db):
    import clear_placeholder_scores

    a = make_coach("a@x")
    player = a.player()
    placeholder, noted, rated, evented, scored = (a.match()["id"] for _ in range(5))
    for match_id in (placeholder, noted, rated, evented):
        a.put(f"/matches/{match_id}/stats", json={"goals_for": 0, "goals_against": 0})
    a.put(f"/matches/{noted}/stats", json={"goals_for": 0, "goals_against": 0, "notes": "Tight game"})
    a.put(f"/matches/{rated}/ratings/{player['id']}", json={"rating": 7})
    res = a.post(f"/matches/{evented}/events", json={"player_id": player["id"], "event_type": "Assist", "minute": 10})
    assert res.status_code == 200, res.text
    a.put(f"/matches/{scored}/stats", json={"goals_for": 2, "goals_against": 0})

    assert clear_placeholder_scores.clear_placeholders(db) == 1
    db.expire_all()
    scores = {m.id: (m.goals_for, m.goals_against) for m in db.query(models.Match).all()}
    assert scores[placeholder] == (None, None)
    assert scores[noted] == scores[rated] == scores[evented] == (0, 0)
    assert scores[scored] == (2, 0)


def test_clear_placeholder_scores_runs_before_new_columns_and_tables_exist(make_coach, db):
    import clear_placeholder_scores
    from sqlalchemy import text

    a = make_coach("a@x")
    match_id = a.match()["id"]
    a.put(f"/matches/{match_id}/stats", json={"goals_for": 0, "goals_against": 0})
    db.execute(text("ALTER TABLE matches DROP COLUMN bench"))
    db.execute(text("ALTER TABLE matches DROP COLUMN duration"))
    db.execute(text("DROP TABLE match_ratings"))
    db.commit()

    assert [m.id for m in clear_placeholder_scores.placeholder_matches(db)] == [match_id]
    assert clear_placeholder_scores.clear_placeholders(db) == 1
    assert db.execute(text("SELECT goals_for, goals_against FROM matches")).one() == (None, None)


def test_confirmed_match_rejects_every_edit_until_unlocked(make_coach):
    a = make_coach("a@x")
    player = a.player()
    match = a.match()
    mid = match["id"]
    assert match["locked"] is False
    event_id = a.post(f"/matches/{mid}/events", json={"player_id": player["id"], "event_type": "Goal", "minute": 5}).json()["id"]
    a.put(f"/matches/{mid}/ratings/{player['id']}", json={"rating": 7})
    sub_id = a.post(f"/matches/{mid}/substitutions", json={"player_in_id": player["id"], "minute": 50}).json()["id"]

    assert a.put(f"/matches/{mid}/lock", json={"locked": True}).json()["locked"] is True
    blocked = [
        a.put(f"/matches/{mid}", json={**match, "opponent": "Changed"}),
        a.put(f"/matches/{mid}/stats", json={"goals_for": 1, "goals_against": 0}),
        a.post(f"/matches/{mid}/events", json={"player_id": player["id"], "event_type": "Goal"}),
        a.delete(f"/match_events/{event_id}"),
        a.put(f"/matches/{mid}/ratings/{player['id']}", json={"rating": 9}),
        a.delete(f"/matches/{mid}/ratings/{player['id']}"),
        a.post(f"/matches/{mid}/substitutions", json={"player_in_id": player["id"], "minute": 60}),
        a.delete(f"/match_substitutions/{sub_id}"),
    ]
    assert [r.status_code for r in blocked] == [409] * len(blocked)
    assert a.get(f"/matches/{mid}/ratings").json()[0]["rating"] == 7

    a.put(f"/matches/{mid}/lock", json={"locked": False})
    assert a.put(f"/matches/{mid}/stats", json={"goals_for": 1, "goals_against": 0}).status_code == 200


def test_only_the_owner_can_confirm_a_match(make_coach):
    a, b = make_coach("a@x"), make_coach("b@x")
    mid = a.match()["id"]
    assert b.put(f"/matches/{mid}/lock", json={"locked": True}).status_code == 404
    assert next(m for m in a.get("/matches", params=a.scoped()).json() if m["id"] == mid)["locked"] is False
