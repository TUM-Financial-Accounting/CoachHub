import os
import re

import models
import seed


def test_seed_exercise_categories_are_canonical():
    # The frontend renders t(`exerciseCategories.${category}`); anything else shows a raw key.
    ts = os.path.join(os.path.dirname(__file__), "..", "..", "src", "lib", "exerciseCategories.ts")
    block = re.search(r"EXERCISE_CATEGORIES = \[(.*?)\]", open(ts, encoding="utf-8").read(), re.S).group(1)
    canonical = set(re.findall(r"'(\w+)'", block))
    assert {category for _, category, *_ in seed.EXERCISES} <= canonical


def test_seed_and_reset_run_with_foreign_keys_enforced(db, capsys):
    seed.seed(reset=False)
    first = db.query(models.MatchRating).count()
    assert first > 0

    seed.seed(reset=True)
    db.expire_all()
    assert db.query(models.MatchRating).count() == first
    assert db.query(models.User).filter(models.User.email == seed.DEMO_EMAIL).count() == 1


def _seasons(db, email):
    user = db.query(models.User).filter(models.User.email == email).one()
    return db.query(models.Season).filter(models.Season.coach_id == user.id).count()


def test_seed_into_another_account_creates_it_with_the_given_password(db, monkeypatch):
    monkeypatch.setattr(seed.getpass, "getpass", lambda prompt="": "s3cret-pass")
    seed.seed(email="coach@x.test")
    user = db.query(models.User).filter(models.User.email == "coach@x.test").one()
    assert seed.pwd_context.verify("s3cret-pass", user.password)
    assert _seasons(db, "coach@x.test") == 2
    assert db.query(models.User).filter(models.User.email == seed.DEMO_EMAIL).count() == 0


def test_seed_fills_an_existing_empty_account_and_keeps_its_password(make_coach, db):
    db.add(models.User(email="Mine@X.test", password=seed.pwd_context.hash("own-password"), full_name="Me"))
    db.commit()
    seed.seed(email="mine@x.test")
    db.expire_all()
    user = db.query(models.User).filter(models.User.email == "Mine@X.test").one()
    assert seed.pwd_context.verify("own-password", user.password)
    assert _seasons(db, "Mine@X.test") == 2


def test_seed_never_wipes_an_account_with_data_without_reset_and_confirmation(make_coach, db):
    coach = make_coach("busy@x.test")
    seed.seed(email="busy@x.test")
    seed.seed(email="busy@x.test", reset=True, confirm=lambda prompt: "wrong@x.test")
    db.expire_all()
    assert db.query(models.Team).filter(models.Team.id == coach.team["id"]).count() == 1

    seed.seed(email="busy@x.test", reset=True, confirm=lambda prompt: "busy@x.test")
    db.expire_all()
    assert db.query(models.Team).filter(models.Team.id == coach.team["id"]).count() == 0
    assert _seasons(db, "busy@x.test") == 2
