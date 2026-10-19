import models


def test_bench_and_duration_are_saved_with_the_match(make_coach):
    a = make_coach("a@x")
    p1, p2 = a.player("Kraft", 9)["id"], a.player("Weber", 10)["id"]
    match = a.match()
    assert match["duration"] == 90

    body = {"opponent": "SV Nord", "date": "2026-09-05", "time": "11:00", "location": "Home",
            "bench": f"{p1},{p2}", "duration": 70}
    assert a.put(f"/matches/{match['id']}", json=body).status_code == 200
    stored = a.get("/matches").json()[0]
    assert (stored["bench"], stored["duration"]) == (f"{p1},{p2}", 70)

    assert a.put(f"/matches/{match['id']}", json={**body, "duration": 0}).status_code == 422
    assert a.put(f"/matches/{match['id']}", json={k: v for k, v in body.items() if k != "duration"}).status_code == 200
    assert a.get("/matches").json()[0]["duration"] == 70


def test_add_list_and_delete_substitutions(make_coach):
    a = make_coach("a@x")
    starter, sub = a.player("Kraft", 9)["id"], a.player("Weber", 10)["id"]
    match = a.match()
    url = f"/matches/{match['id']}/substitutions"

    late = a.post(url, json={"player_in_id": sub, "player_out_id": starter, "minute": 60}).json()
    early = a.post(url, json={"player_in_id": starter, "minute": 10}).json()
    assert [s["minute"] for s in a.get(url).json()] == [10, 60]
    assert early["player_out_id"] is None

    assert a.delete(f"/match_substitutions/{late['id']}").status_code == 200
    assert [s["id"] for s in a.get(url).json()] == [early["id"]]
    assert a.delete(f"/match_substitutions/{late['id']}").status_code == 404


def test_invalid_substitutions_are_rejected(make_coach):
    a = make_coach("a@x")
    p1 = a.player()["id"]
    match = a.match()
    url = f"/matches/{match['id']}/substitutions"
    assert a.post(url, json={"player_in_id": p1, "player_out_id": p1, "minute": 50}).status_code == 400
    assert a.post(url, json={"player_in_id": p1, "minute": -1}).status_code == 422
    assert a.post(url, json={"player_in_id": p1, "minute": 95}).status_code == 400
    assert a.post(url, json={"player_in_id": "missing", "minute": 50}).status_code == 404


def test_substitutions_are_isolated_between_coaches(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    a_player, b_player = a.player()["id"], b.player("Other")["id"]
    a_match, b_match = a.match(), b.match()
    sub = a.post(f"/matches/{a_match['id']}/substitutions", json={"player_in_id": a_player, "minute": 5}).json()

    assert b.get(f"/matches/{a_match['id']}/substitutions").status_code == 404
    assert b.post(f"/matches/{a_match['id']}/substitutions", json={"player_in_id": b_player, "minute": 5}).status_code == 404
    assert b.post(f"/matches/{b_match['id']}/substitutions", json={"player_in_id": a_player, "minute": 5}).status_code == 404
    assert b.delete(f"/match_substitutions/{sub['id']}").status_code == 404
    assert b.get("/stats/substitutions", params={"team_id": a.team["id"]}).status_code == 404


def test_season_substitutions_are_filtered_by_season(make_coach):
    a = make_coach("a@x")
    p1 = a.player()["id"]
    a.post(f"/matches/{a.match()['id']}/substitutions", json={"player_in_id": p1, "minute": 5})
    params = {"team_id": a.team["id"], "season_id": a.season["id"]}
    assert len(a.get("/stats/substitutions", params=params).json()) == 1
    assert a.get("/stats/substitutions", params={**params, "season_id": "other"}).json() == []


def test_substitutions_go_with_their_match_and_players(make_coach, db):
    a = make_coach("a@x")
    p1, p2 = a.player("Kraft", 9)["id"], a.player("Weber", 10)["id"]
    m1, m2 = a.match()["id"], a.match(date="2026-09-12")["id"]
    for mid in (m1, m2):
        a.post(f"/matches/{mid}/substitutions", json={"player_in_id": p2, "player_out_id": p1, "minute": 45})
    a.post(f"/matches/{m2}/substitutions", json={"player_in_id": p1, "minute": 80})

    assert a.delete(f"/matches/{m1}").status_code == 200
    assert a.delete(f"/players/{p2}").status_code == 200
    db.expire_all()
    assert [(s.match_id, s.player_in_id) for s in db.query(models.MatchSubstitution).all()] == [(m2, p1)]

    assert a.delete(f"/seasons/{a.season['id']}").status_code == 200
    db.expire_all()
    assert db.query(models.MatchSubstitution).count() == 0
