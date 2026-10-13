import models


def populate(coach):
    player = coach.player()
    match = coach.match()
    assert coach.post(f"/matches/{match['id']}/events", json={"player_id": player["id"], "event_type": "Goal", "minute": 12}).status_code == 200
    assert coach.put(f"/matches/{match['id']}/ratings/{player['id']}", json={"rating": 8}).status_code == 200
    coach.session()
    coach.event()
    assert coach.post("/training_series", json={"weekdays": [0], "series_start_date": "2026-09-07", "occurrences": 2,
                                                "start_time": "1", "end_time": "2", "focus": "X", "intensity": "Low",
                                                "selected_players": "", "selected_exercises": "", **coach.scoped()}).status_code == 200
    assert coach.post("/event_series", json={"title": "Physio", "start_time": "1", "end_time": "2", "weekdays": [2],
                                             "series_start_date": "2026-09-07", "occurrences": 2, **coach.scoped()}).status_code == 200
    return player, match


def counts(db):
    db.expire_all()
    return {m.__name__: db.query(m).count() for m in (
        models.Match, models.MatchEvent, models.MatchRating, models.TrainingSession, models.TrainingSeries,
        models.Event, models.EventSeries, models.TeamPlayer)}


def test_deleting_a_team_removes_everything_hanging_off_it(make_coach, db):
    a = make_coach("a@x")
    b = make_coach("b@x")
    populate(a)
    populate(b)
    assert a.delete(f"/teams/{a.team['id']}").status_code == 200
    assert all(v == 1 or name in ("TrainingSession", "Event") for name, v in counts(db).items())
    assert len(b.get("/matches").json()) == 1
    assert len(b.get("/training_sessions").json()) == 3
    assert len(b.get("/events").json()) == 3


def test_deleting_a_season_removes_its_teams_and_rows(make_coach, db):
    a = make_coach("a@x")
    populate(a)
    assert a.delete(f"/seasons/{a.season['id']}").status_code == 200
    assert set(counts(db).values()) == {0}
    assert a.get("/teams").json() == []


def test_deleting_a_player_removes_their_events_and_ratings(make_coach, db):
    a = make_coach("a@x")
    player, match = populate(a)
    assert a.delete(f"/players/{player['id']}").status_code == 200
    assert a.get(f"/matches/{match['id']}/events").json() == []
    assert a.get(f"/matches/{match['id']}/ratings").json() == []


def test_deleting_a_match_removes_its_events_and_ratings(make_coach, db):
    a = make_coach("a@x")
    _, match = populate(a)
    assert a.delete(f"/matches/{match['id']}").status_code == 200
    c = counts(db)
    assert (c["Match"], c["MatchEvent"], c["MatchRating"]) == (0, 0, 0)
