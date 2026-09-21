---
description: Per-coach data isolation rules for every backend query. Read before adding or editing a route.
paths:
  - "backend/main.py"
  - "backend/models.py"
  - "backend/schemas.py"
---

# Authorization: per-coach isolation

Isolation is enforced **manually, in every single endpoint**. There is no
scoped-session dependency and no Postgres row-level security. One forgotten
filter leaks another coach's data.

## Two shapes of ownership

**Top-level resources carry `coach_id`** — seasons, teams, players, exercises,
basics, principles, tactics, custom formations, visions, events, feedback.
Filter directly:

```python
db.query(models.Team).filter(models.Team.coach_id == current_user.id)
```

**Nested resources have no `coach_id`** — matches, training sessions, training
series, match events. They are scoped *through* the owning team using the two
helpers in `main.py`:

```python
def owned_team_ids(db, user) -> list[str]   # every team id this coach owns
def require_owned_team(db, user, team_id)   # the team, or raise 404
```

```python
db.query(models.Match).filter(
    models.Match.id == id,
    models.Match.team_id.in_(owned_team_ids(db, current_user)),
).first()
```

Use `require_owned_team` when the request names a team; use `owned_team_ids`
when filtering a collection.

## Non-negotiables

- **Every route that touches user data takes
  `current_user: models.User = Depends(get_current_user)`.** A route without it
  is public.
- **Unauthorized access returns 404, never 403.** Deliberate — the API must not
  confirm that someone else's id exists. Do not "improve" this to 403.
- **Writes are filtered too, not just reads.** A missing filter on a write is
  worse: it silently attaches rows to another coach.
- **Foreign keys supplied in a request body are attacker-controlled.** Any
  `team_id`, `season_id`, or `player_id` arriving from the client must be
  re-checked against the current user before it is stored.

## Known open bug

`create_player` in `backend/main.py` looks up `item.team_id` **without** a
`coach_id` filter, unlike every other endpoint. A coach can attach a newly
created player to another coach's team. Reads are filtered, so the victim never
sees the row — but it is written. Add `require_owned_team` there if you are in
that function for any reason.

## Deletes cascade in Python, not in the database

The foreign keys have **no `ON DELETE CASCADE`**. `delete_team_cascade()` tears
things down in a required order:

```
matches (via ORM delete, so Match.events cascades)
  → training sessions   (they hold the FK to training_series)
  → training series
  → events
  → team                (player_assignments go via relationship cascade)
```

Wrong order aborts the transaction. If you add a table with an FK to `teams`,
add it to `delete_team_cascade()` in the right position.
