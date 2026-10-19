"""
Matches used to be created with a 0:0 score, so an unrecorded match looked like
a played draw. This resets those placeholder scores to "no result" (NULL).

A 0:0 match counts as a placeholder when it has no notes, no goal/assist events
and no ratings. A real 0:0 that was saved without any of those is reset too;
re-enter it from the match's stats window.

Usage:
    cd backend
    python clear_placeholder_scores.py           # list what would change
    python clear_placeholder_scores.py --apply   # write the change
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import inspect, or_
from sqlalchemy.orm import Session

import models
from database import SessionLocal


# Also runs on a database the new build has not started against yet: named columns only,
# and a table that does not exist yet cannot hold events or ratings.
def placeholder_matches(db: Session):
    tables = inspect(db.get_bind()).get_table_names()
    conditions = [
        models.Match.goals_for == 0,
        models.Match.goals_against == 0,
        or_(models.Match.notes.is_(None), models.Match.notes == ""),
    ]
    for child in (models.MatchEvent, models.MatchRating):
        if child.__tablename__ in tables:
            conditions.append(~db.query(child.match_id).filter(child.match_id == models.Match.id).exists())
    return (
        db.query(models.Match.id, models.Match.date, models.Match.opponent)
        .filter(*conditions)
        .order_by(models.Match.date)
        .all()
    )


def clear_placeholders(db: Session) -> int:
    ids = [m.id for m in placeholder_matches(db)]
    if ids:
        db.query(models.Match).filter(models.Match.id.in_(ids)).update(
            {models.Match.goals_for: None, models.Match.goals_against: None}, synchronize_session=False
        )
    db.commit()
    return len(ids)


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    db = SessionLocal()
    try:
        matches = placeholder_matches(db)
        for m in matches:
            print(f"{m.date}  vs {m.opponent}  ({m.id})")
        print(f"{len(matches)} match(es) with a placeholder 0:0 score.")
        if not apply:
            print("Dry run. Re-run with --apply to reset them to 'no result'.")
        elif matches and input("Reset these scores? Type 'yes' to continue: ").strip().lower() == "yes":
            print(f"Reset {clear_placeholders(db)} match(es).")
        else:
            print("Nothing changed.")
    finally:
        db.close()
