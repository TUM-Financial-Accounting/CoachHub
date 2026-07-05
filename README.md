# CoachHub - Sports Team Management Dashboard

A modern, coach-centric web dashboard for managing sports teams, training sessions, and matches. Built with React + TypeScript on the frontend and FastAPI + PostgreSQL on the backend.

## Features

- Dashboard - Team statistics, attendance trends, weekly calendar widget, and quick actions
- Seasons & Teams - Multiple seasons and teams per coach, with team cloning between seasons
- Team Management - Player profiles, photos, roster management, and per-team performance ratings
- Trial Players - Track trialists ("Probespieler") with home club, star rating, and scouting notes; sign them to the squad with one click
- Exercises Library - Create and manage reusable training exercises with media and categories (technique, tactical, athletic, game form, …)
- Training Manager - Build and schedule training sessions (incl. weekly recurring series) with PDF export
- Calendar - Week view combining trainings, matches, and custom team events
- Libraries - Manage Basics, Principles (with media upload), and Tactics
- Match & Lineup - Visual drag-and-drop field positioning, lineup builder, and custom formations; supports 11v11 plus 7v7 / 9v9 youth formats
- Match Stats & Statistics - Record results, goals, and assists; season statistics with charts and leaderboards
- Playbook - Export/import Basics, Principles, Tactics, and Exercises as JSON to share between accounts
- Command Palette - Quick navigation and global search with Ctrl+K / Cmd+K
- Vision Library - Upload and present tactical philosophy PDFs
- Feedback - In-app bug reports, feature requests, and questions
- i18n - Full English and German translations
- Theming - Light, dark, and system mode
- Responsive - Desktop-first with mobile support

---

## Prerequisites

- **Node.js** 16 or higher
- **Python** 3.8 or higher
- **PostgreSQL** running locally or remotely

---

## Setup

### 1. Database

Create a PostgreSQL database, then configure the connection in `backend/.env`:

```bash
DATABASE_URL=postgresql://<user>:<password>@localhost/<db_name>
SECRET_KEY=<any long random string>   # required — used to sign JWTs
FRONTEND_URL=http://localhost:5173    # optional, defaults shown
UPLOAD_DIR=/path/to/persistent/volume # optional — where uploaded media is stored
                                      # (defaults to backend/static/uploads)
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

### 3. Seed Data (optional but recommended)

Run these from inside the `backend/` directory (same as uvicorn):

```bash
cd backend
python seed_libraries.py
python seed_players.py
python seed_past_matches.py
```

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

### Backend

| Package | Purpose |
|---------|---------|
| FastAPI | REST API framework |
| SQLAlchemy | ORM |
| PostgreSQL | Relational database |
| Pydantic | Request / response validation |
| python-multipart | File upload support |

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
    seed_libraries.py    # Seed Basics, Principles, Tactics
    seed_players.py      # Seed player data
    seed_past_matches.py # Seed past match data
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
```

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
| PUT / DELETE | `/training_sessions/{id}` | Update / delete a session (`?scope=this\|future` for series) |
| POST | `/training_series` | Create a weekly recurring series |
| DELETE | `/training_series/{id}` | Delete a series and its occurrences |
| GET / POST | `/events` | List / create calendar events |
| PUT / DELETE | `/events/{id}` | Update / delete a calendar event |
| GET / POST | `/matches` | List / create matches |
| GET | `/matches/latest` | Get next upcoming match |
| PUT | `/matches/{id}` | Update a match |
| PUT | `/matches/{id}/lineup` | Save lineup and formation |
| PUT | `/matches/{id}/stats` | Record final score and notes |
| GET / POST | `/matches/{match_id}/events` | List / add goals and assists |
| DELETE | `/match_events/{id}` | Delete a goal/assist event |
| GET | `/stats/top-performers` | Top scorers and assisters |
| GET | `/match/suggested-formation` | Suggest formation from recent training |
| GET / POST | `/custom_formations` | List / create custom formations |
| DELETE | `/custom_formations/{id}` | Delete a custom formation |
| GET / POST | `/visions` | List / upload vision documents |
| DELETE | `/visions/{id}` | Delete a vision document |
| GET / POST | `/feedback` | List / submit feedback |
| GET | `/playbook/export` | Export libraries as JSON |
| POST | `/playbook/import` | Import libraries from JSON |
| POST | `/upload` | Upload a media file |

---

## Available Scripts

```bash
npm run dev       # Start frontend dev server (Vite, port 5173)
npm run build     # Build frontend for production
npm run preview   # Preview production build
```

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

- Backend uses `snake_case`; frontend uses `camelCase`. Conversion helpers are in `src/lib/utils.ts`.
- Several fields (e.g. `selected_players`, `linked_tactics`) are stored as comma-separated strings in PostgreSQL and parsed on both sides.

---

## Browser Support

Chrome, Firefox, Safari, and Edge (latest versions).

## License
MIT
