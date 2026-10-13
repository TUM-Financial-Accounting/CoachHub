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
