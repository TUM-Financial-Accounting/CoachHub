from datetime import timedelta

import models


def register(client, email="new@x", password="secret1", name="New Coach"):
    return client.post("/register", json={"email": email, "password": password, "full_name": name})


def login(client, email="new@x", password="secret1"):
    return client.post("/login", json={"email": email, "password": password})


def bearer(res):
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_register_login_and_me(client):
    created = register(client)
    assert created.status_code == 200
    assert created.json()["email"] == "new@x"
    assert register(client).status_code == 400

    res = login(client)
    assert res.status_code == 200
    assert res.json()["user"] == {"email": "new@x", "full_name": "New Coach", "role": "coach"}
    assert "access_token" in res.cookies

    assert client.get("/me", headers=bearer(res)).json() == {"email": "new@x", "full_name": "New Coach", "role": "coach"}


def test_wrong_password_is_rejected(client):
    register(client)
    assert login(client, password="wrong").status_code == 401
    assert login(client, email="nobody@x").status_code == 401


def test_logout_revokes_the_token(client):
    # Own email: the blacklist is process-wide and same-second tokens are identical.
    register(client, email="logout@x")
    headers = bearer(login(client, email="logout@x"))
    assert client.post("/logout", headers=headers).status_code == 200
    assert client.get("/me", headers=headers).status_code == 401


def test_password_reset_flow(client, db):
    register(client)
    assert client.post("/forgot-password", json={"email": "new@x"}).status_code == 200
    token = db.query(models.User).filter_by(email="new@x").one().reset_token

    assert client.post("/reset-password", json={"token": "bogus", "new_password": "x"}).status_code == 400
    assert client.post("/reset-password", json={"token": token, "new_password": "changed1"}).status_code == 200
    assert client.post("/reset-password", json={"token": token, "new_password": "again"}).status_code == 400
    assert login(client).status_code == 401
    assert login(client, password="changed1").status_code == 200


def test_expired_reset_token_is_rejected(client, db):
    register(client)
    client.post("/forgot-password", json={"email": "new@x"})
    user = db.query(models.User).filter_by(email="new@x").one()
    user.reset_token_expires = models.utcnow() - timedelta(minutes=1)
    db.commit()
    assert client.post("/reset-password", json={"token": user.reset_token, "new_password": "x"}).status_code == 400


def test_email_verification(client, db):
    register(client)
    token = db.query(models.User).filter_by(email="new@x").one().verification_token
    assert client.post("/verify-email", json={"token": "bogus"}).status_code == 400
    assert client.post("/verify-email", json={"token": token}).status_code == 200
    assert client.post("/verify-email", json={"token": token}).status_code == 400
