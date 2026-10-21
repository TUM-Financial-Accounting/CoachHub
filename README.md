# CoachHub - Sports Team Management Dashboard

A modern, coach-centric web dashboard for managing sports teams, training sessions, and matches. Built with React + TypeScript on the frontend and FastAPI + PostgreSQL on the backend.

## Features

- Dashboard - Team statistics, attendance trends, weekly calendar widget, and quick actions
- Seasons & Teams - Multiple seasons and teams per coach, with team cloning between seasons
- Team Management - Player profiles, photos, roster management, and per-team performance ratings
- Trial Players - Track trialists ("Probespieler") with home club, star rating, and scouting notes; sign them to the squad with one click
- Exercises Library - Create and manage reusable training exercises with media and categories (technique, tactical, athletic, game form, …). An exercise without an uploaded picture can be sketched in a built-in drill editor (cones, players, coach, poles, balls, zones, goals, text, and run / dribble / pass / shot arrows on a blank, full or half pitch); the sketch is stored as JSON on the exercise
- Training Manager - Take attendance after a session (present / absent with a reason); recorded sessions drive the attendance rates on the dashboard, squad and season report, unrecorded ones still count the planned squad. Build and schedule training sessions (incl. weekly recurring series) with PDF export. The export opens with a printable session sheet: an info column (ISO calendar week, date, focus, times, numbered squad, colour key) next to one card per drill. A drill shows the picture uploaded under its Visualisierungen when it has one, otherwise the diagram drawn in the exercise's drill editor (rendered to PNG at export time), and only as a last resort an auto-generated pitch diagram derived from its title/setup (see `Uebungsbenennung.md`). The written detail table follows
- Calendar - Week view combining trainings, matches, and custom team events; drag & drop to reschedule (15-minute snapping, duration preserved)
- Settings - Personalisation: theme, language, which item types the calendar draws, player birthdays as all-day entries, first day of the week, visible hours, and the start page (stored per account in the browser)
- Google Calendar - Each coach connects their own Google account from Settings. CoachHub creates a "CoachHub" calendar and keeps trainings, matches and events in it, pushing on every change and pulling dates/times back from Google. Setup and behaviour: `GOOGLE_CALENDAR.md`
- Libraries - Manage Basics, Principles (with media upload), and Tactics
- Match & Lineup - Visual drag-and-drop field positioning, lineup builder, and custom formations; supports 11v11 plus 7v7 / 9v9 youth formats
- Match Stats & Statistics - Record results, goals, assists, the bench and substitutions (minutes played; matches carry their own length, default 90), and per-match player ratings (1-10, separate from the season rating on the squad page); season statistics with charts and leaderboards
- Season Report - One-click PDF (EN/DE) from the Statistics page: results with match MVPs (highest match rating, ties shared), squad stats with match-rating averages, awards, goal timing, formations, training load, and per-player profiles. Generated in the browser (`src/lib/seasonReport/`), no backend endpoint
- Playbook - Export/import Basics, Principles, Tactics, and Exercises as JSON to share between accounts
- Command Palette - Quick navigation and global search with Ctrl+K / Cmd+K
- Vision Library - Upload and present tactical philosophy PDFs
- Feedback - In-app bug reports, feature requests, and questions
- Admin - Superuser role with a read-only admin page: all feedback (with triage), account metadata, and platform aggregates. Reaching it needs a second factor: the `ADMIN_ACCESS_CODE` from the server environment, entered after login and valid for 30 minutes in that browser tab (see `SUPERUSER.md`)
- i18n - Full English and German translations
- Theming - Light, dark, and system mode
- Responsive - Desktop-first with mobile support

---

## Prerequisites

- **Node.js** 20.19+ or 22.12+ (required by Vite 7)
- **Python** 3.9 or higher
- **PostgreSQL** running locally or remotely

---

## Setup

### 1. Database

Create a PostgreSQL database, then copy `backend/.env.example` to `backend/.env` and fill it in:

```bash
cp backend/.env.example backend/.env
```

```bash
DATABASE_URL=postgresql://<user>:<password>@localhost/<db_name>
SECRET_KEY=<any long random string>   # required — the API refuses to boot without it
ADMIN_ACCESS_CODE=<second secret>     # required to open the admin area; without it
                                      # /admin/* stays locked for everyone
FRONTEND_URL=http://localhost:5173    # optional, defaults shown
UPLOAD_DIR=/path/to/persistent/volume # optional — where uploaded media is stored
                                      # (defaults to backend/static/uploads)

# Email (all optional). With none of these set, verification and password-reset
# links are printed to the API console instead of being sent.
RESEND_API_KEY=<resend api key>       # preferred: Resend HTTP API
RESEND_FROM="CoachHub <onboarding@resend.dev>"
SMTP_HOST=<smtp host>                 # fallback: plain SMTP
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASSWORD=<smtp password>
SMTP_FROM=noreply@coachhub.com
```

### 2. Backend

```bash
# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start the API server — run from inside the backend/ directory
cd backend
uvicorn main:app --reload
```

API available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

### 3. Seed Demo Data (optional but recommended)

`seed.py` creates a complete demo account — two seasons, two squads, a populated
exercise library, recurring training series, played matches with goals and
assists (so the statistics views have real data), upcoming fixtures, and
calendar events. Run it from inside `backend/`:

```bash
cd backend
python seed.py                                # refuses to run if the demo account already has data
python seed.py --reset                        # delete the demo coach's data first, then re-seed
python seed.py --email me@example.com         # seed another account; created (password prompt) if missing
python seed.py --email me@example.com --reset # wipe that account's data and re-seed (asks you to type the email)
```

An existing account is seeded only while it has no seasons; with data in it,
`--reset` is required. `--reset` only ever touches rows belonging to that
account. It never drops tables and never touches other users' data.

Then log in with **`demo@coachhub.app`** / **`demo1234`**, or with your own
account and its password.

> `seed_libraries.py`, `seed_players.py`, and `seed_past_matches.py` are the
> building blocks `seed.py` imports. Running them standalone requires the demo
> user (and, for some, teams and seasons) to already exist — use `seed.py`
> unless you specifically want one slice of the data.

> **Upgrading an existing database:** matches used to be created with a 0:0
> score, so unplayed or unrecorded matches counted as draws. New matches now
> have no score until one is entered, and past matches without one show as
> **U** and stay out of every total. To clear the old placeholder 0:0 scores
> (0:0 with no notes, events or ratings), run `python clear_placeholder_scores.py`
> to list them and `--apply` to reset them. It writes data — check `DATABASE_URL` first.

### 4. Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### 5. Create an Account

Open the app, go to the Login page, and use the **Register** option to create your first user.
Alternatively call `POST /register` via the interactive API docs at `/docs`.

---

## Tech Stack

### Frontend

| Package | Purpose |
|---------|---------|
| React 18 | UI library |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Tailwind CSS | Styling |
| Framer Motion | Animations |
| Lucide React | Icons |
| Recharts | Charts |
| React DnD | Drag-and-drop lineup builder |
| Sonner | Toast notifications |
| React Hook Form | Form handling |
| jsPDF + jspdf-autotable | PDF export of training plans |
| i18next + react-i18next | English / German localization |
| Vitest + jsdom | Test runner |

### Backend

| Package | Purpose |
|---------|---------|
| FastAPI | REST API framework |
| SQLAlchemy | ORM |
| PostgreSQL | Relational database |
| Pydantic | Request / response validation |
| passlib + bcrypt | Password hashing |
| python-jose | JWT signing and verification |
| python-multipart | File upload support |
| python-dotenv | Loads `backend/.env` |
| cryptography | Fernet encryption for stored Google refresh tokens |

---

## Project Structure

```
IDPDashboard/
 backend/
    main.py              # FastAPI app and all route definitions
    models.py            # SQLAlchemy ORM models
    schemas.py           # Pydantic request / response schemas
    database.py          # DB engine and session config
    security.py          # Password hashing, JWT creation/validation
    email_service.py     # Verification / password-reset emails
    seed.py              # One-shot demo seeder (run this one)
    seed_libraries.py    # Building block: Basics, Principles, Tactics
    seed_players.py      # Building block: player data
    seed_past_matches.py # Building block: sessions and past matches
    .env.example         # Copy to .env and fill in
 src/
    components/
       Dashboard.tsx          # Overview cards, attendance chart, week widget
       TeamManagement.tsx     # Squad roster table + player modal
       PlayerSlideOver.tsx
       TrainingManager.tsx    # Session planning incl. recurring series
       CalendarView.tsx       # Full-page week calendar
       WeekCalendar.tsx       # Shared week-grid component
       StatisticsView.tsx     # Season stats, charts, leaderboards
       ExercisesLibrary.tsx
       ExerciseSlideOver.tsx
       BasicsLibrary.tsx
       PrinciplesLibrary.tsx
       TacticsLibrary.tsx
       MatchLineup.tsx        # Drag-and-drop lineup on a pitch
       MatchStatsModal.tsx    # Result, goals & assists entry
       CustomFormationModal.tsx
       VisionLibrary.tsx
       FeedbackView.tsx
       PlaybookManagementModal.tsx
       TeamFormModal.tsx / SeasonFormModal.tsx / DeleteTeamModal.tsx
       Navigation.tsx
       LoginPage.tsx
       CommandPalette.tsx
       ui/                    # Shared primitives (Button, Card, Modal, Input,
                              # Select, DatePicker, TimePicker, SessionSlideOver, …)
    contexts/                 # SeasonContext, TeamContext, ThemeContext
    services/                 # One API service per resource + shared api-client
    lib/                      # data-mappers, upload helper, api-config,
                              # exercise categories, boot prefetch, utils
    locales/                  # en.ts / de.ts translation dictionaries
    types/                    # Shared TypeScript models and UI types
    test/                     # Vitest setup (storage reset between tests)
    styles/
       globals.css
    App.tsx
    main.tsx
    i18n.ts
 index.html
 package.json
 tailwind.config.js
 tsconfig.json
 vite.config.ts
 vitest.config.ts
```

Tests live next to the code they cover as `*.test.ts`.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` / `/logout` | Authenticate / end the session |
| POST | `/register` | Register a new user |
| POST | `/forgot-password` / `/reset-password` | Password reset flow |
| POST | `/verify-email` | Verify an email address |
| GET | `/me` | Current user profile (session check) |
| GET / POST | `/seasons` | List / create seasons |
| DELETE | `/seasons/{id}` | Delete a season (cascades to its teams) |
| GET / POST | `/teams` | List / create teams |
| PUT / DELETE | `/teams/{id}` | Update / delete a team |
| POST | `/teams/{id}/clone` | Clone a team into another season |
| GET / POST | `/players` | List / create players |
| PUT / DELETE | `/players/{id}` | Update / delete a player |
| PUT | `/players/{id}/performance` | Update per-team performance rating |
| POST / DELETE | `/players/{player_id}/teams/{team_id}` | Assign / remove a player from a team |
| GET / POST | `/exercises` | List / create exercises |
| PUT / DELETE | `/exercises/{id}` | Update / delete an exercise |
| GET / POST | `/basics` | List / create basics |
| PUT / DELETE | `/basics/{id}` | Update / delete a basic |
| GET / POST | `/principles` | List / create principles |
| PUT / DELETE | `/principles/{id}` | Update / delete a principle |
| GET / POST | `/tactics` | List / create tactics |
| PUT / DELETE | `/tactics/{id}` | Update / delete a tactic |
| GET / POST | `/training_sessions` | List / create training sessions |
| PUT / DELETE | `/training_sessions/{id}` | Update / delete a session (`?scope=this\|future\|all` for series; series-wide updates keep dates) |
| POST | `/training_series` | Create a recurring series (`frequency`: weekly / biweekly / monthly, `weekdays`: 0=Mon..6=Sun, ends on `series_end_date` or after `occurrences`, max 200) |
| DELETE | `/training_series/{id}` | Delete a series and its occurrences |
| GET / PUT | `/training_sessions/{id}/attendance` | Who actually came: read / replace the whole list (`status` present\|absent, `reason` injury\|illness\|school\|excused\|unexcused for absences) |
| GET | `/stats/attendance` | All recorded attendance of a team (`?team_id=&season_id=`) |
| GET / POST | `/events` | List / create calendar events |
| PUT / DELETE | `/events/{id}` | Update / delete a calendar event (`?scope=this\|future\|all` for series; series-wide updates keep dates) |
| POST | `/event_series` | Create a recurring calendar event series (same pattern fields as training series) |
| GET / POST | `/matches` | List / create matches |
| GET | `/matches/latest` | Get next upcoming match |
| PUT / DELETE | `/matches/{id}` | Update / delete a match (delete removes its events too) |
| PUT | `/matches/{id}/stats` | Record final score and notes (a new match has no score until this is called) |
| PUT | `/matches/{match_id}/lock` | Confirm (`{"locked": true}`) or unlock a match. A confirmed match answers 409 to every edit of its details, lineup, score, events, ratings and substitutions |
| GET / POST | `/matches/{match_id}/events` | List / add goals and assists |
| DELETE | `/match_events/{id}` | Delete a goal/assist event |
| GET / POST | `/matches/{match_id}/substitutions` | List / record a substitution (`player_in_id`, optional `player_out_id`, `minute` within the match length) |
| DELETE | `/match_substitutions/{id}` | Delete a substitution |
| GET | `/stats/substitutions` | All substitutions of a team (`?team_id=&season_id=`) |
| GET | `/matches/{match_id}/ratings` | List the per-match player ratings |
| PUT / DELETE | `/matches/{match_id}/ratings/{player_id}` | Set (upsert, body `{rating: 1-10}`) / clear a player's match rating |
| GET | `/stats/ratings` | All match ratings of a team (`?team_id=&season_id=`) |
| GET | `/stats/top-performers` | Top scorers and assisters |
| GET | `/match/suggested-formation` | Suggest formation from recent training: `{formation, kind: "training" \| "default", session_date, exercise_name}` (`source` is a legacy English sentence) |
| GET / POST | `/custom_formations` | List / create custom formations |
| DELETE | `/custom_formations/{id}` | Delete a custom formation |
| GET / POST | `/visions` | List / upload vision documents |
| DELETE | `/visions/{id}` | Delete a vision document |
| GET / POST | `/feedback` | List / submit feedback |
| GET | `/google/status` | Google Calendar connection state for the current coach |
| POST | `/google/auth-url` | Build the Google consent URL (takes the browser's time zone) |
| GET | `/auth/google/callback` | OAuth redirect target; must match the URI registered in Google Cloud |
| POST | `/google/sync` | Pull dates/times from Google, then push everything else |
| DELETE | `/google/disconnect` | Revoke the token and forget the account |
| POST | `/google/webhook` | Google push notification receiver (no auth; verified by channel token) |
| GET | `/admin/stats` | Superuser: global aggregate counts |
| GET | `/admin/users` | Superuser: account metadata list |
| GET | `/admin/feedback` | Superuser: all feedback with author identity |
| PUT | `/admin/feedback/{id}/status` | Superuser: set feedback status |
| GET | `/playbook/export` | Export libraries as JSON |
| POST | `/playbook/import` | Import libraries from JSON |
| POST | `/upload` | Upload a media file |

---

## Available Scripts

### Frontend

```bash
npm run dev            # Start frontend dev server (Vite, port 5173)
npm run build          # Type-check (tsc) and build for production
npm run preview        # Preview the production build locally
npm start              # Serve the built dist/ folder (used by the Railway deploy)
npm run lint           # ESLint (hooks rules + typescript-eslint recommended)
npm run test           # Run the Vitest suite once
npm run test:watch     # Run Vitest in watch mode
npm run test:coverage  # Run with a coverage report
```

### Backend

```bash
cd backend
uvicorn main:app --reload   # Start the API on :8000
python seed.py              # Seed the demo account
python create_superuser.py admin@example.com --name "Site Admin"  # create a superuser (prompts for password)
python create_superuser.py existing@example.com --promote         # promote an existing account
pip install -r requirements-dev.txt  # pytest, httpx, ruff (local only; Railway installs requirements.txt)
python -m pytest            # Backend tests (throwaway SQLite, never DATABASE_URL)
python -m ruff check .      # Lint (config in backend/ruff.toml)
```

---

## Testing

The frontend has a [Vitest](https://vitest.dev) suite covering the pure logic
where a regression is most expensive — the API boundary and the browser-storage
behaviour that survives reloads and logouts:

| File | Covers |
|------|--------|
| `src/lib/data-mappers.test.ts` | `snake_case` ⇄ `camelCase` mapping in both directions |
| `src/services/api-client.test.ts` | Headers, auth token, 204 bodies, error surfacing, 401 session teardown |
| `src/lib/bootPrefetch.test.ts` | Boot-phase parallel prefetch and the single-consumer handover |
| `src/lib/lastSelection.test.ts` | Per-account season/team stash across logout → login |
| `src/lib/api-config.test.ts` | Base-URL resolution |
| `src/lib/utils.test.ts` | Class merging and timezone-safe date formatting |

```bash
npm install   # first time only
npm run test
```

Config lives in `vitest.config.ts`; `src/test/setup.ts` clears `localStorage`
and `sessionStorage` around every test.

The backend has a `pytest` suite in `backend/tests/` that drives the real
FastAPI app (`TestClient`, real JWTs) against a throwaway SQLite file with
foreign keys enforced. `tests/conftest.py` pins every env var before importing
`main`, so `backend/.env` and its `DATABASE_URL` are never used, and it refuses
to run against anything but SQLite.

| File | Covers |
|------|--------|
| `tests/test_ownership.py` | Per-coach isolation: lists, reads, writes and deletes on another coach's rows → 404 |
| `tests/test_series.py` | Recurring training/event series: creation, validation, `this` / `future` / `all` scopes |
| `tests/test_cascade.py` | Team, season, player and match deletes with everything hanging off them |
| `tests/test_matches.py` | Match ratings, top performers, suggested formation, unrecorded scores and `clear_placeholder_scores.py` |
| `tests/test_recurrence.py` | `recurrence.expand` patterns (weekly, biweekly, monthly n-th weekday) |
| `tests/test_attendance.py` | Training attendance: save/replace, validation, per-coach isolation, cascade on session/player/team delete |
| `tests/test_substitutions.py` | Match bench and length, substitutions, validation, isolation, cascade on match/player/season delete |
| `tests/test_auth.py` | Register, login, logout, password reset, email verification |
| `tests/test_library.py` | Basics, principles, tactics, exercises, custom formations, playbook export/import |
| `tests/test_routes.py` | Match stats/events, latest match, series delete, team clone, upload, visions, Google status, admin |
| `tests/test_validation.py`, `test_players.py`, `test_admin_feedback.py`, `test_email.py`, `test_seed.py` | Schema validation, team assignment (incl. double-submit), squad view shape, admin feedback, email routing, `seed.py --reset` |

```bash
cd backend
pip install -r requirements-dev.txt   # first time only
python -m pytest
```

Together they call 93 of the 94 API routes; only the Google OAuth callback needs a live Google account.

SQLite is not Postgres: `_ensure_columns()` (Postgres-only SQL) is skipped in
tests, so column backfills are still verified by hand on startup.

**Not covered yet** — React components and contexts have no render tests, and
there is no CI running either suite.

---

## Deployment

The app is deployed on **Railway** as two services (frontend + backend) plus a
PostgreSQL instance. There is **no deploy config committed to this repo** — no
`railway.json`, `Procfile`, or `nixpacks.toml`. Everything is configured in the
Railway dashboard, so the settings below are the contract the code expects.

**Backend service**

| Setting | Value |
|---|---|
| Root directory | `backend/` |
| Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Required env | `DATABASE_URL`, `SECRET_KEY` |
| Admin env | `ADMIN_ACCESS_CODE` — step-up code for `/admin/*`; unset means the admin area is unreachable |
| Google env | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_PUBLIC_URL` — unset means the Settings row stays disabled (see `GOOGLE_CALENDAR.md`) |
| Important env | `FRONTEND_URL`, `UPLOAD_DIR` |

- `SECRET_KEY` is mandatory — `security.py` raises at import if it is unset, so
  the service will crash-loop rather than start with a default.
- `FRONTEND_URL` drives CORS *and* the login cookie flags: an `https://` value
  is treated as a cross-origin deploy, which switches the cookie to
  `SameSite=None; Secure`. CORS additionally allows any `*.railway.app` origin
  via a regex.
- `UPLOAD_DIR` **must** point at a mounted volume. The container filesystem is
  ephemeral, so with the default (`backend/static/uploads`) every uploaded
  player photo and vision PDF disappears on the next redeploy.
- `sqlalchemy` is pinned to `<2.1` in `requirements.txt`. SQLAlchemy 2.1 makes
  `postgresql://` use psycopg 3, but only `psycopg2-binary` is installed, so an
  unpinned rebuild crashes at startup with `No module named 'psycopg'`.

**Frontend service**

| Setting | Value |
|---|---|
| Build | `npm run build` |
| Start command | `npm start` (`npx serve -s dist -l $PORT`) |
| Required env | `VITE_API_URL` — the backend service's public URL |

`VITE_API_URL` is baked in at **build** time, not read at runtime — changing it
requires a rebuild, not just a restart.

**Schema changes.** There is no migration tool. New tables are created by
`Base.metadata.create_all()` at startup, and new *columns* on existing tables
must be added to the `_ensure_columns()` list in `main.py`, which runs
idempotent `ADD COLUMN IF NOT EXISTS` statements on every boot. That function
is Postgres-specific and deliberately swallows its own errors so a bad
statement can never take the API down — which also means a failed backfill is
silent. Check the startup logs after adding one.

---

## Authorization Model

**The most important invariant in this codebase.** Every resource belongs to a
coach, and isolation is enforced *manually, endpoint by endpoint*. One
forgotten filter is a data breach, so read this before adding a route.

Top-level resources (seasons, teams, players, exercises, the libraries, custom
formations, visions, events, feedback) carry a `coach_id` and are filtered
directly:

```python
db.query(models.Team).filter(models.Team.coach_id == current_user.id)
```

Nested resources (matches, training sessions, series, match events) have **no**
`coach_id` of their own — they are scoped *through* the owning team using the
two helpers in `main.py`:

```python
def owned_team_ids(db, user) -> list[str]      # every team id this coach owns
def require_owned_team(db, user, team_id)      # the team, or raise 404
```

```python
db.query(models.Match).filter(
    models.Match.id == id,
    models.Match.team_id.in_(owned_team_ids(db, current_user)),
).first()
```

Unauthorized access returns **404, not 403** — deliberately, so the API never
confirms that someone else's id exists.

**Superuser.** `users.role` (`coach` default / `superuser`) unlocks the
cross-tenant `/admin/*` endpoints via the `require_superuser` dependency
(404 for everyone else). Scope is deliberately narrow — all feedback with
author identity, account metadata, and aggregate counts; never coach content.
Roles are assigned only by `backend/create_superuser.py`, never through the
API. The full rights concept lives in `SUPERUSER.md`.

**Deletes are cascaded in Python, not by the database.** `delete_team_cascade()`
tears down matches (via the ORM, so `Match.events` cascades) → sessions →
series → events → team, in that order. The foreign keys have no
`ON DELETE CASCADE`, so a delete written in the wrong order aborts the
transaction.

---

## Feature Details

### Training Sessions

Sessions reference exercises from three library layers:
1. **Basics** - Fundamental concepts (optional diagram image)
2. **Principles** - Coaching philosophy (optional media upload)
3. **Tactics** - Tactical systems (optional diagram, suggested drills)

### Match & Lineup

- Create upcoming fixtures with opponent, date, time, and location.
- Drag and drop players onto a visual pitch using React DnD.
- Formation is auto-suggested from tactics used in training sessions within the last 7 days; defaults to 4-4-2 if none found.

### Authentication

Login and registration are handled by the FastAPI backend (`/login`, `/register`). Passwords are hashed with bcrypt, and a successful login sets an HttpOnly JWT cookie (the token is also returned for header-based auth). The frontend stores an `isAuthenticated` flag in `localStorage` for session persistence across page reloads.

### Media Uploads

Images and videos can be attached to Basics, Principles, and Exercises. Files are uploaded via `POST /upload`, saved to `static/uploads/`, and served as static assets by FastAPI at `/static/uploads/<filename>`.

### Data Conventions

- Backend uses `snake_case`; frontend uses `camelCase`. Conversion happens in exactly one place: `src/lib/data-mappers.ts`.
- Several fields (e.g. `selected_players`, `linked_tactics`) are stored as comma-separated strings in PostgreSQL and parsed on both sides.

---

## Known Limitations

Honest list of the sharp edges, for whoever picks this up next.

| Area | Limitation |
|---|---|
| Logout | The JWT blacklist is an in-memory `set()` in `security.py`. It empties on restart and is not shared across workers, so a logged-out token becomes valid again after a redeploy. Move it to Redis. |
| Tokens | 4-hour access tokens, no refresh tokens. Coaches get logged out mid-session; shortening the window makes that worse. |
| Email verification | Registration sets `is_verified=True` unconditionally (`main.py`), so the verification email is informational only. This is a deployment gap — there was no DNS for a sending domain — not a design decision. Re-enable by removing that flag. |
| Rate limiting | None. `/login` and `/forgot-password` are unbounded and brute-forceable. |
| Isolation | Ownership is enforced correctly but by hand at every endpoint (see Authorization Model). A scoped-session dependency or Postgres row-level security would make it structural. |
| Migrations | No Alembic. Column additions go in `_ensure_columns()`, which is Postgres-only and fails silently. |
| Data model | Multi-value fields (`selected_players`, `selected_exercises`, `linked_tactics`, `linked_basics`, `linked_principles`, `equipment`) are comma-separated strings, not join tables. They cannot be queried or joined on. |
| Equipment names | The equipment choices (`EQUIPMENT_OPTIONS` in `src/lib/domain.ts`) are stored and shown as English text, so German users see English. Translating them means storing a canonical key like the exercise categories do, which needs a migration of existing rows. |
| Routing | `backend/main.py` is ~1,900 lines of routes in one file. It should be split into per-resource FastAPI routers. Route naming is mixed (`/custom_formations` vs `/forgot-password`, `/match/suggested-formation` vs `/matches/...`) but is part of the API contract, so it stays. |
| Caching | The season/team contexts are a hand-rolled cache. `cache:seasons:v1` / `cache:teams:v2` never expire — a schema change needs a manual key bump. TanStack Query would remove roughly 200 lines. |
| Bundle | No route-level code splitting; one bundle ships everything, so the login page pulls in Recharts and jsPDF. |
| Tests | Frontend logic and a backend `pytest` suite on SQLite (see Testing). No component tests, no CI. |
| Timestamps | `DateTime` columns are naive UTC (`models.utcnow()`). Switching to timezone-aware values needs a migration of stored rows. |
| Monitoring | No error tracking or CI gate in front of deploys. |

One concrete bug worth knowing about: `create_player` (`backend/main.py`) looks
up `item.team_id` **without** a `coach_id` filter, unlike every other endpoint.
A coach can attach a newly created player to another coach's team. Reads are
filtered by `coach_id`, so the other coach never sees the player — but the
assignment row is written. Add the filter.

---

## Browser Support

Chrome, Firefox, Safari, and Edge (latest versions).

## License
MIT
