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
