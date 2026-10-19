import pytest

import database
import main
import models
import schemas


def test_team_view_returns_every_player_field_with_the_team_rating(make_coach):
    a = make_coach("a@x")
    player = a.player()
    a.put(f"/players/{player['id']}", json={**{k: v for k, v in player.items() if k not in ("team_id", "season_id")},
                                            "clothing_size": "M", "strong_foot": "Left", "height": 170})
    assert a.put(f"/players/{player['id']}/performance", json={"performance": 8, "team_id": a.team["id"]}).status_code == 200

    rows = a.get("/players", params={"team_id": a.team["id"], "season_id": a.season["id"]}).json()
    assert len(rows) == 1
    row = rows[0]
    expected = set(schemas.PlayerCreate.model_fields) - {"team_id", "season_id"} | {"performance", "teams"}
    assert set(row) == expected
    assert (row["clothing_size"], row["strong_foot"], row["height"], row["performance"]) == ("M", "Left", 170, 8)
    assert [t["id"] for t in row["teams"]] == [a.team["id"]]


def test_team_view_is_scoped_to_the_season(make_coach):
    a = make_coach("a@x")
    a.player()
    assert a.get("/players", params={"team_id": a.team["id"], "season_id": "other"}).json() == []


def test_assigning_twice_is_idempotent(make_coach, db):
    a = make_coach("a@x")
    player = {k: v for k, v in a.player().items() if k not in ("team_id", "season_id")}
    # A pool player (no team yet) assigned to a newly created team, as in the squad's "all players" view.
    a.post("/players", json={**player, "id": "pool-1", "last_name": "Pool"})
    new_team = a.post("/teams", json={"name": "U17", "season_id": a.season["id"]}).json()
    url = f"/players/pool-1/teams/{new_team['id']}"
    for _ in range(2):
        assert a.post(url, params={"season_id": a.season["id"]}).status_code == 200
    db.expire_all()
    assert db.query(models.TeamPlayer).filter_by(player_id="pool-1", team_id=new_team["id"]).count() == 1


@pytest.mark.filterwarnings("ignore::sqlalchemy.exc.SAWarning")
def test_racing_duplicate_assignment_still_succeeds(make_coach, client):
    a = make_coach("a@x")
    player_id = a.player()["id"]
    params = {"season_id": a.season["id"]}
    url = f"/players/{player_id}/teams/{a.team['id']}"

    # The row already exists, but this request's existence check misses it, as when a
    # double click's first request commits between the second one's check and commit.
    session = database.SessionLocal()
    real_query = session.query

    def query(*entities):
        if entities == (models.TeamPlayer,):
            class NotYetVisible:
                def filter(self, *_):
                    return self

                def first(self):
                    return None
            return NotYetVisible()
        return real_query(*entities)

    session.query = query
    main.app.dependency_overrides[database.get_db] = lambda: session
    try:
        assert a.post(url, params=params).status_code == 200
    finally:
        main.app.dependency_overrides.clear()
        session.close()


def test_remove_player_from_team(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    player_id = a.player()["id"]
    url = f"/players/{player_id}/teams/{a.team['id']}"
    params = {"season_id": a.season["id"], "team_id": a.team["id"]}
    assert b.delete(url, params={"season_id": a.season["id"]}).status_code == 404
    assert a.delete(url, params={"season_id": a.season["id"]}).status_code == 200
    assert a.get("/players", params=params).json() == []
