# CoachHub — Code Map (SUMMARY)

Quick orientation map of the codebase, split backend / frontend, organized by
workflow and feature. Rules and invariants live in `CLAUDE.md` and
`.claude/rules/`; this file only says **where things are and how they connect**.

---

## Big Picture

```
Browser (React 18 + TS + Vite, repo root /src)
   │  fetch via src/services/api-client.ts  (JWT cookie + Bearer header)
   ▼
FastAPI (backend/main.py — ALL routes in one file, ~1,470 lines)
   │  SQLAlchemy ORM (backend/models.py)
   ▼
PostgreSQL  (no Alembic — tables via create_all(), columns via _ensure_columns())
```

- Single-tenant-per-coach: every row belongs to one coach; isolation is manual
  at every endpoint (`.claude/rules/authorization.md`).
- API speaks `snake_case`, UI speaks `camelCase`; conversion happens **only** in
  `src/lib/data-mappers.ts`.

---

## Backend (`backend/`)

### Files

| File | Role |
|---|---|
| `main.py` | FastAPI app + every route (decorator style), `_ensure_columns()` startup backfill, ownership helpers `owned_team_ids()` / `require_owned_team()`, `delete_team_cascade()` |
| `models.py` | All SQLAlchemy models (see table list below) |
| `schemas.py` | Pydantic request/response schemas |
| `database.py` | Engine + `get_db()` session dependency |
| `security.py` | bcrypt hashing, JWT create/verify, in-memory logout blacklist; **raises at import if `SECRET_KEY` unset** |
| `email_service.py` | Verification / password-reset mail (Resend → SMTP → console fallback) |
| `seed.py` | Demo-data entry point (`--reset` wipes only the demo coach); imports `seed_libraries.py`, `seed_players.py`, `seed_past_matches.py` |
| `clear_db.py` | Destructive — never run without explicit confirmation |
| `create_superuser.py` | Create or `--promote` a superuser (the only way to assign roles); password via `getpass`, bcrypt-hashed |

### Data model (`models.py`)

- **Auth / tenant root:** `User` (coach)
- **Coach-owned directly (`coach_id` column):** `Season`, `Team`, `Player`,
  `Exercise`, `Basic`, `Principle`, `Tactic`, `CustomFormation`, `Vision`,
  `Event`, `FeedbackRequest`
- **Scoped through the team (no `coach_id`):** `Match`, `MatchEvent`,
  `TrainingSession`, `TrainingSeries`
- **Join table:** `TeamPlayer` (player ⇄ team, per-team performance rating)
- Multi-value fields (`selected_players`, `selected_exercises`, `linked_*`,
  `equipment`) are **comma-separated strings**, not join tables.

### Routes by feature (all in `main.py`, line numbers approximate)

| Feature | Endpoints | Notes |
|---|---|---|
| Auth | `POST /register /login /logout /forgot-password /reset-password /verify-email`, `GET /me` (~L145–298) | HttpOnly JWT cookie + token in body; logout blacklist is in-memory |
| Uploads | `POST /upload` (~L300) | Saves to `UPLOAD_DIR` (default `static/uploads/`), served at `/static/uploads/*` |
| Seasons | `GET/POST /seasons`, `DELETE /seasons/{id}` (~L315) | Delete cascades to teams (in Python) |
| Teams | `GET/POST /teams`, `PUT/DELETE /teams/{id}`, `POST /teams/{id}/clone` (~L474) | `delete_team_cascade()` order matters: matches → sessions → series → events → team |
| Players | `GET/POST /players`, `PUT/DELETE /players/{id}`, `PUT /players/{id}/performance`, `POST/DELETE /players/{pid}/teams/{tid}` (~L1135) | Includes trial players. Known bug: `create_player` misses a `coach_id` filter on `team_id` lookup (README Known Limitations) |
| Libraries | `GET/POST/PUT/DELETE` for `/exercises /basics /principles /tactics` (~L548–838) | Media via `/upload`; exercises have categories |
| Training | `GET/POST/PUT/DELETE /training_sessions` (`?scope=this\|future` for series edits), `POST/DELETE /training_series` (~L840–1058) | Weekly recurring series semantics live here — highest-risk logic |
| Matches | `GET/POST /matches`, `GET /matches/latest`, `PUT/DELETE /matches/{id}`, `PUT …/lineup`, `PUT …/stats`, `GET/POST /matches/{id}/events`, `DELETE /match_events/{id}` (~L716–1460) | Lineup = formation + positions; events = goals/assists |
| Formations | `GET/POST /custom_formations`, `DELETE /custom_formations/{id}`; `GET /match/suggested-formation` (~L446, L1331) | Suggestion derived from tactics used in trainings in the last 7 days, fallback 4-4-2 |
| Stats | `GET /stats/top-performers` (~L771) | Scorers / assisters for StatisticsView |
| Calendar | `GET/POST /events`, `PUT/DELETE /events/{id}` (~L389) | Custom team events; trainings/matches come from their own endpoints |
| Vision | `GET/POST /visions`, `DELETE /visions/{id}` (~L1060) | PDF upload/presentation |
| Playbook | `GET /playbook/export`, `POST /playbook/import` (~L1091) | JSON export/import of the four libraries |
| Feedback | `GET/POST /feedback` (~L357) | In-app bug reports / feature requests |
| Admin | `POST /admin/unlock`; `GET /admin/stats /admin/users /admin/feedback`, `PUT /admin/feedback/{id}/status` | Two gates: `require_superuser` (404 for others) **and** `require_admin_unlocked` (403 without a valid `X-Admin-Token` from `/admin/unlock`, which trades `ADMIN_ACCESS_CODE` for a 30-min scoped JWT; never answers 401, that would log the coach out). Cross-tenant on purpose, scope limited to feedback + metadata + aggregates — see `SUPERUSER.md`. Role assigned only by `create_superuser.py` |

### Backend workflows

- **Run:** `cd backend && uvicorn main:app --reload` (flat imports — must run
  from inside `backend/`). Docs at `:8000/docs`.
- **Schema change:** add column to `models.py` **and** to `_ensure_columns()`
  in `main.py`; restart uvicorn and read the startup log (failures are silent).
  See `.claude/rules/backend-schema.md`.
- **Verify:** no pytest suite — exercise the route through `/docs` by hand.
- **Seed:** `python seed.py` (login `demo@coachhub.app` / `demo1234`).

---

## Frontend (`src/`)

### Layers

| Layer | Path | Role |
|---|---|---|
| Entry / shell | `main.tsx`, `App.tsx` | Auth boot gate (splash until `/me` confirms), page switching via `Page` union in `types/ui.ts` — **no router library**; logout clears localStorage keys + caches |
| Contexts | `contexts/` | `SeasonContext`, `TeamContext` (active selection + hand-rolled `localStorage` cache `cache:seasons:v1` / `cache:teams:v1`), `ThemeContext` (light/dark/system), `SettingsContext` (per-account personalisation, key `settings:<email>`) |
| Services | `services/` | One file per resource → shared `api-client.ts` (base URL from `lib/api-config.ts`, Bearer header from `localStorage.access_token`, 401 → session teardown). Components never call `fetch` directly |
| Mapping | `lib/data-mappers.ts` | The only snake ⇄ camel boundary |
| Lib | `lib/` | `drillDiagram.ts` (derives a schematic drill spec from an exercise's name/setup/equipment) + `drillRenderer.ts` (draws it into jsPDF), `adminUnlock.ts` (admin step-up token in sessionStorage), `bootPrefetch.ts` (parallel prefetch at module load, single-consumer handover), `lastSelection.ts` (per-account season/team restore across logout), `storageKeys.ts` (every localStorage key + `SESSION_KEYS`), `session.ts` (`clearSession()` for logout, 401 and failed boot), `uploadFile.ts`, `uuid.ts` (client-minted IDs for optimistic UI), `exerciseCategories.ts`, `dateParse.ts`, `utils.ts` |
| i18n | `i18n.ts`, `locales/en.ts` + `locales/de.ts` | Every user-facing string via `t('key')`, both files always (`.claude/rules/i18n.md`) |
| UI primitives | `components/ui/` | Button, Card, Modal, Input, Select, DatePicker, TimePicker, ConfirmDialog, Skeleton, CountUp, SessionSlideOver — reuse before writing new ones |
| Types | `types/models.ts`, `types/ui.ts` | Shared domain + UI types (`Page` = the app's route list) |
| Tests | `*.test.ts` next to code, `test/setup.ts` | Vitest; covers mappers, api-client, bootPrefetch, lastSelection, api-config, utils. No component tests |

### Pages / features (`Page` value → component → services used)

| Page | Component(s) | Feature |
|---|---|---|
| `login` | `LoginPage` | Login / register / forgot-password (`auth-service`) |
| `dashboard` | `Dashboard`, `WeekCalendar` | Stat cards, attendance chart, week widget, quick actions |
| `team` | `TeamManagement`, `PlayerSlideOver`, `EmptyStateTeam` | Roster, player profiles/photos, trial players, per-team ratings (`player-service`, `team-service`) |
| `calendar` | `CalendarView`, `WeekCalendar` | Week view merging trainings + matches + events (`event-service`, `training-service`, `match-service`); drag & drop rescheduling (react-dnd, 15-min snap; series occurrences move with `scope=this`, i.e. they detach) |
| `training` / `session-planner` | `TrainingManager`, `ui/SessionSlideOver` | Session planning, weekly recurring series, PDF export via jsPDF (async — it fetches uploaded pictures first). Session sheet: each drill shows its uploaded image (`lib/media.ts`) or, failing that, a diagram derived from its title/setup (`lib/drillDiagram.ts` + `lib/drillRenderer.ts`); the detail table follows (`training-service`) |
| `basics` / `principles` / `tactics` | `BasicsLibrary`, `PrinciplesLibrary`, `TacticsLibrary` | Library CRUD with media upload (`library-service`) |
| — | `ExercisesLibrary`, `ExerciseSlideOver` | Exercise library with categories (`exercise-service`) — reached from Training |
| `match` | `MatchLineup`, `MatchStatsModal`, `CustomFormationModal` | React-DnD pitch lineup, 11v11 / 9v9 / 7v7 formats, custom formations, result + goals/assists entry (`match-service`, `formation-service`) |
| `statistics` | `StatisticsView` | Recharts season stats, leaderboards (`match-service`, stats endpoint) |
| `vision` | `VisionLibrary` | Tactical-philosophy PDF upload & presentation |
| `feedback` | `FeedbackView` | Bug reports / feature requests (`feedback-service`) |
| `settings` | `SettingsView` | Personalisation: theme, language, calendar visibility toggles, player birthdays, week start, visible hours, start page. Backed by `SettingsContext` + `lib/settings.ts` (per-account `localStorage`, no backend). Google Calendar row is a disabled placeholder |
| `admin` | `AdminView` | Superuser only: platform stats, all-user feedback triage, account list (`admin-service`); nav entry hidden unless `role === 'superuser'` |
| (global) | `Navigation`, `BottomNav`, `CommandPalette` (Ctrl/Cmd+K), `SeasonSwitcher`, `TeamSwitcher`, `TeamFormModal`, `SeasonFormModal`, `DeleteTeamModal`, `PlaybookManagementModal` | Shell, navigation, season/team switching & CRUD, playbook JSON export/import |

### Frontend workflows

- **Run:** `npm run dev` → `:5173` (backend must be running separately).
- **Gate before "done":** `npm run build` (tsc `--strict`, unused imports are
  errors) then `npm run test` (vitest). No lint, no CI — the build is the only
  automated check.
- **Data flow for any new feature:** component → `services/<resource>-service.ts`
  → `api-client` → map in `data-mappers.ts` → render. New strings into **both**
  `locales/en.ts` and `locales/de.ts`. See `.claude/rules/frontend-data-flow.md`.

---

## End-to-end workflows (cross-cutting)

1. **Auth/session:** login → JWT cookie + `localStorage.access_token` +
   `isAuthenticated` flag → on reload `bootPrefetch` fires `/me` at module load,
   `App.tsx` splash waits on it → 401 anywhere tears the session down;
   network errors keep the user in (offline tolerance).
2. **Season/team selection:** `SeasonContext`/`TeamContext` hold the active pair,
   cached in `localStorage`, restored per account by `lastSelection.ts` after
   re-login. Almost every list request is implicitly scoped by the active team.
3. **Training → Match:** exercises/tactics used in sessions during the last
   7 days feed `GET /match/suggested-formation`; the lineup builder starts from
   that suggestion.
4. **Content sharing:** Playbook export/import moves the four libraries between
   coach accounts as JSON.

---

## Sharp edges to remember (details in README "Known Limitations")

- `create_player` ownership-filter bug; in-memory JWT blacklist; no refresh
  tokens; email verification bypassed; no rate limiting; comma-separated
  multi-value columns; `_ensure_columns()` fails silently; single-file
  `main.py`; never-expiring frontend caches; no component/backend tests; no CI.
- `Uebungsbenennung.md` (German, coach-facing) documents the naming keywords
  `lib/drillDiagram.ts` parses. Change one without the other and the guide lies.
- `backend/.env` is live credentials — never read or print it
  (`backend/.env.example` documents the variables).
- Deploy is Railway, configured only in the dashboard (no config in repo);
  `VITE_API_URL` is baked at build time; `UPLOAD_DIR` must be a mounted volume.
