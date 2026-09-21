---
description: How to change the database schema in a project with no migration tool.
paths:
  - "backend/models.py"
  - "backend/main.py"
  - "backend/database.py"
  - "backend/seed*.py"
---

# Schema changes without migrations

There is **no Alembic**. Two mechanisms, and they cover different cases:

| Change | Mechanism |
|---|---|
| New **table** | `models.Base.metadata.create_all()` at import time in `main.py`. Automatic. |
| New **column** on an existing table | `_ensure_columns()` in `main.py`. **Manual — you must add it.** |
| Type change, rename, drop, constraint | Nothing automatic. Needs hand-written SQL and a deliberate plan. |

## Adding a column

Adding the field to `models.py` is **not enough**. `create_all()` never alters
an existing table, so the app will start and then fail at query time on any
database that already has the table.

Both steps are required:

1. Add the column to the model in `backend/models.py`.
2. Add an idempotent statement to the `statements` list in `_ensure_columns()`:

```python
"ALTER TABLE players ADD COLUMN IF NOT EXISTS home_club VARCHAR",
```

Constraints on new columns:

- **Must be nullable or have a `DEFAULT`.** The statement runs against tables
  that already hold rows.
- **`ADD COLUMN IF NOT EXISTS` is Postgres-only.** This project is
  Postgres-only; do not add SQLite fallbacks.
- **Never remove an existing statement.** They must stay for databases that
  have not run the newer build yet.

## The failure mode you must check for

`_ensure_columns()` wraps everything in `try/except Exception` and only
`print()`s on failure — deliberately, so a bad statement can never take the API
down. That also means **a failed backfill is silent**. The app boots, and the
column is simply missing.

After adding a statement, restart uvicorn and read the startup output for:

```
[startup] column backfill skipped: ...
```

If that line appears, none of the statements after the failure ran either — the
whole block is one transaction (`engine.begin()`).

## Seed scripts

`seed.py` is the entry point and refuses to run if the demo account exists.
`seed_libraries.py`, `seed_players.py`, `seed_past_matches.py` are building
blocks it imports and assume the demo user (and sometimes teams/seasons) already
exist.

`seed.py --reset` and `clear_db.py` are destructive. `DATABASE_URL` may point at
the production Railway database — **confirm with the user before running
either.**

## Multi-value fields are comma-separated strings

`selected_players`, `selected_exercises`, `linked_tactics`, `linked_basics`,
`linked_principles`, and `equipment` are stored as comma-joined strings, not
join tables. They cannot be queried or joined on. Parse on both sides. Match the
existing pattern rather than introducing a join table for one field — that
migration is a deliberate project, not a drive-by change.
