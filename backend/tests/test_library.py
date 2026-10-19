import pytest

LIBRARY = {
    "basics": ({"name": "First Touch", "description": "Cushion the ball"}, {"description": "Kill it dead"}),
    "principles": ({"name": "Counter-Press", "game_phase": "Transition", "description": "Win it back"},
                   {"coaching_notes": "Five seconds"}),
    "tactics": ({"name": "High Press", "formation": "4-3-3", "description": "Press high"}, {"formation": "4-4-2"}),
    "exercises": ({"name": "Rondo 5v2", "category": "Technique", "intensity": "Medium", "description": "Keep the ball"},
                  {"intensity": "High"}),
}


@pytest.mark.parametrize("resource", LIBRARY)
def test_library_crud_and_isolation(make_coach, resource):
    a = make_coach("a@x")
    b = make_coach("b@x")
    body, change = LIBRARY[resource]

    created = a.post(f"/{resource}", json=body)
    assert created.status_code == 200, created.text
    item_id = created.json()["id"]
    assert [i["id"] for i in a.get(f"/{resource}").json()] == [item_id]

    updated = a.put(f"/{resource}/{item_id}", json={**body, **change})
    assert updated.status_code == 200
    key, value = next(iter(change.items()))
    assert updated.json()[key] == value

    assert b.get(f"/{resource}").json() == []
    assert b.put(f"/{resource}/{item_id}", json=body).status_code == 404
    assert b.delete(f"/{resource}/{item_id}").status_code == 404

    assert a.delete(f"/{resource}/{item_id}").status_code == 200
    assert a.get(f"/{resource}").json() == []
    assert a.delete(f"/{resource}/{item_id}").status_code == 404


def test_tactic_update_without_diagram_keeps_the_stored_one(make_coach):
    a = make_coach("a@x")
    tactic = a.post("/tactics", json={"name": "Low Block", "formation": "5-4-1", "description": "Sit deep",
                                      "diagram_url": "/static/uploads/d.png"}).json()
    a.put(f"/tactics/{tactic['id']}", json={"name": "Low Block", "formation": "5-4-1", "description": "Deeper"})
    assert a.get("/tactics").json()[0]["diagram_url"] == "/static/uploads/d.png"


def test_client_supplied_tactic_id_is_kept(make_coach):
    a = make_coach("a@x")
    res = a.post("/tactics", json={"id": "tac-1", "name": "Mid Block", "formation": "4-4-2", "description": "Hold"})
    assert res.json()["id"] == "tac-1"


def test_custom_formations(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    formation = a.post("/custom_formations", json={"name": "3-1-4-2", "positions": "[]"}).json()
    assert [f["name"] for f in a.get("/custom_formations").json()] == ["3-1-4-2"]
    assert b.get("/custom_formations").json() == []
    assert b.delete(f"/custom_formations/{formation['id']}").status_code == 404
    assert a.delete(f"/custom_formations/{formation['id']}").status_code == 200
    assert a.get("/custom_formations").json() == []


def test_playbook_export_and_import_skip_duplicates(make_coach):
    a = make_coach("a@x")
    b = make_coach("b@x")
    for resource, (body, _) in LIBRARY.items():
        a.post(f"/{resource}", json=body)

    exported = a.get("/playbook/export").json()
    assert {k: len(v) for k, v in exported.items()} == {"basics": 1, "principles": 1, "tactics": 1, "exercises": 1}

    assert b.post("/playbook/import", json=exported).json()["message"].startswith("Successfully imported 4 items")
    assert b.post("/playbook/import", json=exported).json()["message"].startswith("Successfully imported 0 items")
    assert [t["name"] for t in b.get("/tactics").json()] == ["High Press"]
    assert len(a.get("/tactics").json()) == 1
