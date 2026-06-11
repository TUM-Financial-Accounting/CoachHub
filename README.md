# CoachHub - Sports Team Management Dashboard

A modern, coach-centric web dashboard for managing sports teams, training sessions, and matches. Built with React + TypeScript on the frontend and FastAPI + PostgreSQL on the backend.

## Features

- Dashboard - Team statistics and quick actions
- Team Management - Player profiles, photos, and roster management
- Exercises Library - Create and manage reusable training exercises with media
- Training Manager - Build and schedule training sessions with PDF export
- Libraries - Manage Basics, Principles (with media upload), and Tactics
- Match & Lineup - Visual drag-and-drop field positioning and lineup builder
- Command Palette - Quick navigation with Ctrl+K / Cmd+K
- Dark Mode - Always-on dark theme
- Responsive - Optimized for desktop (1440px width)

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
    database.py          # DB engine and session config (update credentials here)
    seed_libraries.py    # Seed Basics, Principles, Tactics
    seed_players.py      # Seed player data
    seed_past_matches.py # Seed past match data
 src/
    components/
       Dashboard.tsx
       TeamManagement.tsx
       PlayerSlideOver.tsx
       TrainingManager.tsx
       ExercisesLibrary.tsx
       ExerciseSlideOver.tsx
       BasicsLibrary.tsx
       PrinciplesLibrary.tsx
       TacticsLibrary.tsx
       MatchLineup.tsx
       Navigation.tsx
       LoginPage.tsx
       CommandPalette.tsx
       ui/              # Shared UI primitives (Button, Card, Modal, Input, etc.)
    lib/
       utils.ts         # snake_case <-> camelCase helpers, misc utilities
       uploadFile.ts    # File upload helper
    styles/
       globals.css
    App.tsx
    main.tsx
 static/
    uploads/             # Uploaded media files served by FastAPI
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
| POST | `/login` | Authenticate a user |
| POST | `/register` | Register a new user |
| GET / POST | `/players` | List / create players |
| PUT / DELETE | `/players/{id}` | Update / delete a player |
| GET / POST | `/exercises` | List / create exercises |
| PUT / DELETE | `/exercises/{id}` | Update / delete an exercise |
| GET / POST | `/basics` | List / create basics |
| PUT / DELETE | `/basics/{id}` | Update / delete a basic |
| GET / POST | `/principles` | List / create principles |
| PUT / DELETE | `/principles/{id}` | Update / delete a principle |
| GET / POST | `/tactics` | List / create tactics |
| PUT / DELETE | `/tactics/{id}` | Update / delete a tactic |
| GET / POST | `/training_sessions` | List / create training sessions |
| PUT / DELETE | `/training_sessions/{id}` | Update / delete a session |
| GET / POST | `/matches` | List / create matches |
| GET | `/matches/latest` | Get next upcoming match |
| PUT | `/matches/{id}` | Update a match |
| GET | `/match/suggested-formation` | Suggest formation from recent training |
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
