import models
import security


def test_admin_feedback_list_and_status_update(make_coach, db):
    coach = make_coach("coach@x")
    assert coach.post("/feedback", json={"type": "bug", "title": "Chart", "description": "Overflow"}).status_code == 200

    admin = make_coach("admin@x")
    user = db.get(models.User, admin.id)
    user.role = "superuser"
    db.commit()
    admin.headers["X-Admin-Token"] = security.create_admin_token("admin@x")

    items = admin.get("/admin/feedback").json()
    assert [(i["title"], i["status"], i["coach_email"], i["coach_name"]) for i in items] == [("Chart", "new", "coach@x", "coach@x")]

    res = admin.put(f"/admin/feedback/{items[0]['id']}/status", json={"status": "resolved"})
    assert res.status_code == 200
    assert (res.json()["status"], res.json()["coach_email"]) == ("resolved", "coach@x")
    assert admin.put(f"/admin/feedback/{items[0]['id']}/status", json={"status": "done"}).status_code == 422
