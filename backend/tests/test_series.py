import pytest

import models

# 7 Sep 2026 is a Monday; Mon + Wed for three weeks.
DATES = ["2026-09-07", "2026-09-09", "2026-09-14", "2026-09-16", "2026-09-21", "2026-09-23"]


def make_training_series(coach, **extra):
    body = {"weekdays": [0, 2], "series_start_date": DATES[0], "occurrences": 6, "start_time": "17:00",
            "end_time": "18:30", "focus": "Pressing", "intensity": "Medium", "selected_players": "",
            "selected_exercises": "", **coach.scoped(), **extra}
    res = coach.post("/training_series", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def sessions_by_date(coach):
    return {s["date"]: s for s in coach.get("/training_sessions").json()}


def session_body(focus, date="2030-01-01"):
    # The date is deliberately off-pattern: series-wide updates must ignore it.
    return {"date": date, "start_time": "18:00", "end_time": "19:30", "focus": focus, "intensity": "High",
            "selected_players": "", "selected_exercises": ""}


def test_series_materialises_every_occurrence(make_coach, db):
    a = make_coach("a@x")
    res = make_training_series(a)
    assert res["occurrences_created"] == 6
    assert sorted(sessions_by_date(a)) == DATES
    series = db.get(models.TrainingSeries, res["series"]["id"])
    assert (series.frequency, series.weekdays, str(series.series_end_date)) == ("weekly", "0,2", DATES[-1])


@pytest.mark.parametrize("body, detail", [
    ({"occurrences": 0}, "occurrences"),
    ({"occurrences": None, "series_end_date": None}, "required"),
    ({"occurrences": None, "series_end_date": "2026-09-01"}, "before"),
    ({"weekdays": [7]}, "weekdays"),
    ({"frequency": "daily"}, "frequency"),
])
def test_invalid_patterns_are_rejected(make_coach, body, detail):
    a = make_coach("a@x")
    res = a.post("/training_series", json={"weekdays": [0], "series_start_date": DATES[0], "occurrences": 3,
                                           "start_time": "1", "end_time": "2", "focus": "X", "intensity": "Low",
                                           "selected_players": "", "selected_exercises": "", **a.scoped(), **body})
    assert res.status_code == 400
    assert detail in res.json()["detail"]
    assert a.get("/training_sessions").json() == []


def test_legacy_single_day_of_week_still_works(make_coach):
    a = make_coach("a@x")
    res = make_training_series(a, weekdays=None, day_of_week=0, occurrences=2)
    assert res["occurrences_created"] == 2
    assert sorted(sessions_by_date(a)) == ["2026-09-07", "2026-09-14"]


def test_update_scopes(make_coach):
    a = make_coach("a@x")
    make_training_series(a)
    s = sessions_by_date(a)

    res = a.put(f"/training_sessions/{s['2026-09-14']['id']}", params={"scope": "this"}, json=session_body("Solo", "2026-09-15"))
    assert res.status_code == 200
    s = sessions_by_date(a)
    assert s["2026-09-15"]["focus"] == "Solo" and s["2026-09-15"]["is_modified"] is True

    a.put(f"/training_sessions/{s['2026-09-16']['id']}", params={"scope": "future"}, json=session_body("Future"))
    s = sessions_by_date(a)
    assert sorted(s) == ["2026-09-07", "2026-09-09", "2026-09-15", "2026-09-16", "2026-09-21", "2026-09-23"]
    assert [s[d]["focus"] for d in sorted(s)] == ["Pressing", "Pressing", "Solo", "Future", "Future", "Future"]

    a.put(f"/training_sessions/{s['2026-09-21']['id']}", params={"scope": "all"}, json=session_body("All"))
    s = sessions_by_date(a)
    assert [s[d]["focus"] for d in sorted(s)] == ["All", "All", "Solo", "All", "All", "All"]
    assert s["2026-09-07"]["start_time"] == "18:00"


def test_delete_future_trims_the_series_end(make_coach, db):
    a = make_coach("a@x")
    series_id = make_training_series(a)["series"]["id"]
    s = sessions_by_date(a)
    assert a.delete(f"/training_sessions/{s['2026-09-16']['id']}", params={"scope": "future"}).status_code == 200
    assert sorted(sessions_by_date(a)) == DATES[:3]
    assert str(db.get(models.TrainingSeries, series_id).series_end_date) == "2026-09-15"


@pytest.mark.parametrize("scope, target", [("all", "2026-09-16"), ("future", DATES[0])])
def test_deleting_the_whole_series_removes_the_template(make_coach, db, scope, target):
    a = make_coach("a@x")
    series_id = make_training_series(a)["series"]["id"]
    s = sessions_by_date(a)
    assert a.delete(f"/training_sessions/{s[target]['id']}", params={"scope": scope}).status_code == 200
    assert sessions_by_date(a) == {}
    assert db.get(models.TrainingSeries, series_id) is None


def test_delete_this_keeps_the_rest(make_coach):
    a = make_coach("a@x")
    make_training_series(a)
    s = sessions_by_date(a)
    a.delete(f"/training_sessions/{s['2026-09-09']['id']}")
    assert sorted(sessions_by_date(a)) == [d for d in DATES if d != "2026-09-09"]


def test_event_series_scopes(make_coach, db):
    a = make_coach("a@x")
    res = a.post("/event_series", json={"title": "Physio", "start_time": "18:00", "end_time": "19:00", "weekdays": [0, 2],
                                        "series_start_date": DATES[0], "occurrences": 6, **a.scoped()})
    assert res.status_code == 200, res.text
    assert res.json()["occurrences_created"] == 6
    series_id = res.json()["series_id"]
    events = {e["date"]: e for e in a.get("/events").json()}
    assert sorted(events) == DATES and all(e["series_id"] == series_id for e in events.values())

    body = {"title": "Recovery", "date": "2030-01-01", "start_time": "17:00", "end_time": "18:00"}
    a.put(f"/events/{events['2026-09-16']['id']}", params={"scope": "future"}, json=body)
    events = {e["date"]: e for e in a.get("/events").json()}
    assert sorted(events) == DATES
    assert [events[d]["title"] for d in DATES] == ["Physio"] * 3 + ["Recovery"] * 3
    assert db.get(models.EventSeries, series_id).title == "Recovery"

    a.delete(f"/events/{events['2026-09-14']['id']}", params={"scope": "future"})
    assert sorted(e["date"] for e in a.get("/events").json()) == DATES[:2]
    assert str(db.get(models.EventSeries, series_id).series_end_date) == "2026-09-13"

    a.delete(f"/events/{events['2026-09-07']['id']}", params={"scope": "all"})
    assert a.get("/events").json() == []
    db.expire_all()
    assert db.get(models.EventSeries, series_id) is None
