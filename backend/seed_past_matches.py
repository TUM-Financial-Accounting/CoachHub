"""
Seed script: Training Sessions & Matches (with events)

Exports:
    seed_training_sessions(db, team_id, season_id, player_ids, exercise_ids,
                           day_offset=0) -> list[TrainingSession]
    seed_matches(db, team_id, season_id, players,
                 day_offset=0, season_index=0) -> list[Match]

season_index controls which match dataset is used (0=oldest, 1=middle, 2=current),
giving each season distinct scorelines and goal scorers.

day_offset shifts all dates back so seasons don't overlap in time.

Can also be run standalone:
    cd backend
    python seed_past_matches.py
"""

import sys, os, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal, engine
from models import Base, User, Team, Season, Player, Exercise, TrainingSession, Match, MatchEvent, MatchRating
import random

Base.metadata.create_all(bind=engine)

DEMO_EMAIL = "demo@coachhub.com"
TODAY = datetime.date.today()


def _ago(n, offset=0):
    return TODAY - datetime.timedelta(days=n + offset)


def _ahead(n, offset=0):
    return TODAY + datetime.timedelta(days=n) - datetime.timedelta(days=offset)


# ---------------------------------------------------------------------------
# Lineup helper
# ---------------------------------------------------------------------------

def _make_lineup(players: list) -> str:
    """
    Build a 4-3-3 lineup JSON in the format the frontend expects:
    [{slotId: str, player: {...}}, ...]
    """
    p_by_jersey = {p.jersey_number: p for p in players}

    slots = [
        (1,  "gk",  "GK"),
        (3,  "lb",  "LB"),
        (5,  "lcb", "CB"),
        (4,  "rcb", "CB"),
        (2,  "rb",  "RB"),
        (6,  "lcm", "CM"),
        (7,  "cdm", "CM"),
        (8,  "rcm", "CM"),
        (11, "lw",  "LW"),
        (9,  "st",  "ST"),
        (10, "rw",  "RW"),
    ]

    lineup = []
    for jersey, slot_id, pos in slots:
        p = p_by_jersey.get(jersey)
        if not p:
            continue
        lineup.append({
            "slotId": slot_id,
            "player": {
                "id": p.id,
                "firstName": p.first_name,
                "lastName": p.last_name,
                "jerseyNumber": p.jersey_number,
                "position": p.position,
                "status": p.status,
                "positionSlot": slot_id,
                "isStarter": True,
                "performance": 0,
                "dateOfBirth": p.date_of_birth or "",
                "height": p.height or 0,
                "weight": p.weight or 0,
                "playerPhone": p.player_phone or "",
                "imageUrl": "",
                "attendance": p.attendance or 0,
                "motherName": "", "motherPhone": "",
                "fatherName": "", "fatherPhone": "",
                "teams": [],
            },
        })
    return json.dumps(lineup)


# ---------------------------------------------------------------------------
# Per-season match datasets
# Each tuple: (opponent, time, location, formation, goals_for, goals_against,
#              notes, [(event_type, jersey, minute), ...])
# ---------------------------------------------------------------------------

# 2023/2024 — Building season: inconsistent, more losses, fewer goals
MATCHES_SEASON_0 = [
    ("Riverside Athletic", "14:00", "Home", "4-4-2", 1, 2,
     "Lost control after half-time. Defensive shape was inconsistent. Conceded two set-piece goals we need to address.",
     [("Goal", 9, 34)]),
    ("Northgate United",   "14:00", "Away", "4-4-2", 0, 1,
     "Struggled to create chances away from home. Midfield was overrun. Need more physicality in central areas.",
     []),
    ("Eastside FC",        "11:00", "Home", "4-4-2", 2, 2,
     "Two goals up at half-time but couldn't hold on. Defensive errors in transition cost us. A point is a fair result.",
     [("Goal", 9, 18), ("Assist", 11, 18), ("Goal", 12, 45)]),
    ("Southbank Rovers",   "14:00", "Away", "4-4-2", 0, 3,
     "Difficult afternoon. Their pressing overwhelmed our build-up. Need to work on playing out of pressure.",
     []),
    ("Westfield City",     "15:00", "Home", "4-4-2", 1, 1,
     "Better second half showing. Caleb Martin's goal showed real quality. Defense more organized.",
     [("Goal", 9, 67)]),
    ("Hillcrest Academy",  "14:00", "Away", "4-4-2", 2, 3,
     "Conceded three again. Pressing triggers are not being executed. Set up a dedicated session for next week.",
     [("Goal", 11, 22), ("Goal", 9, 58)]),
    ("Lakeside Academy",   "14:00", "Home", "4-4-2", 3, 1,
     "Best performance of the season so far. High press worked well. Caleb Martin hat-trick was outstanding.",
     [("Goal", 9, 11), ("Assist", 7, 11),
      ("Goal", 9, 49), ("Assist", 8, 49),
      ("Goal", 9, 78)]),
    ("Bridgewater FC",     "11:00", "Away", "4-4-2", 1, 2,
     "Fell behind early. Showed some fight but couldn't get the equalizer. Long way to go this season.",
     [("Goal", 11, 55)]),
]

# 2024/2025 — Developing season: more consistent, transitioning to 4-3-3
MATCHES_SEASON_1 = [
    ("Riverside Athletic", "14:00", "Home", "4-3-3", 2, 1,
     "First win in the new system. High press working better. Benjamin Lee and Caleb Martin combining well.",
     [("Goal", 9, 23), ("Assist", 11, 23),
      ("Goal", 11, 71)]),
    ("Northgate United",   "14:00", "Away", "4-3-3", 1, 1,
     "Away draw is progress. Held our shape well in the second half. Midfield trio controlled the tempo.",
     [("Goal", 7, 55)]),
    ("Eastside FC",        "11:00", "Home", "4-3-3", 3, 1,
     "Convincing home win. Wide overloads created space consistently. Three different scorers — very encouraging.",
     [("Goal", 9, 14), ("Assist", 10, 14),
      ("Goal", 11, 38), ("Assist", 2, 38),
      ("Goal", 12, 82)]),
    ("Southbank Rovers",   "14:00", "Away", "4-3-3", 1, 2,
     "Frustrating. Dominated first half but gave away two cheap goals after the break. Transition defending still needs work.",
     [("Goal", 10, 31)]),
    ("Westfield City",     "15:00", "Home", "4-3-3", 2, 0,
     "Clean sheet! Defensive compactness was excellent. Counter-attack goals were clinical.",
     [("Goal", 9, 45), ("Assist", 7, 45),
      ("Goal", 11, 88)]),
    ("Hillcrest Academy",  "14:00", "Away", "4-3-3", 2, 2,
     "Twice ahead but couldn't close it out. Work still needed on managing games from the front.",
     [("Goal", 9, 17), ("Assist", 8, 17),
      ("Goal", 9, 64)]),
    ("Lakeside Academy",   "14:00", "Home", "4-3-3", 3, 0,
     "Dominant display. Zonal set piece defending flawless — claimed every corner. Press won 5 turnovers.",
     [("Goal", 9, 9),  ("Assist", 7, 9),
      ("Goal", 11, 55), ("Assist", 9, 55),
      ("Goal", 8, 79)]),
    ("Bridgewater FC",     "11:00", "Away", "4-3-3", 2, 1,
     "Good away win. Elijah Brown was exceptional in midfield. Controlled the second half well.",
     [("Goal", 9, 33), ("Assist", 11, 33),
      ("Goal", 7, 70)]),
]

# 2025/2026 — Current season: best form, clinical in front of goal
MATCHES_SEASON_2 = [
    ("Riverside Athletic", "14:00", "Home", "4-3-3", 3, 1,
     "Strong first half performance. High press was effective. Need to work on set piece defending after conceding from a corner.",
     [("Goal", 9, 12), ("Assist", 11, 12),
      ("Goal", 10, 34), ("Assist", 8, 34),
      ("Goal", 9, 67)]),
    ("Northgate United",   "14:00", "Away", "4-3-3", 2, 0,
     "Excellent defensive shape. Counter-attacks were clinical. Benjamin Lee was outstanding wide right. Clean sheet deserved.",
     [("Goal", 11, 23), ("Assist", 9, 23),
      ("Goal", 9, 78)]),
    ("Eastside FC",        "11:00", "Home", "4-3-3", 4, 2,
     "Dominant possession — 68%. Wide channel overloads created three clear chances. Must cut out individual errors in transition.",
     [("Goal", 9, 8),  ("Assist", 10, 8),
      ("Goal", 11, 29), ("Assist", 6, 29),
      ("Goal", 9, 51), ("Assist", 11, 51),
      ("Goal", 12, 83)]),
    ("Southbank Rovers",   "14:00", "Away", "4-4-2", 1, 1,
     "Tough game on a heavy pitch. Switched to 4-4-2 mid-block at half-time. Held out well but lacked creativity.",
     [("Goal", 10, 55)]),
    ("Westfield City",     "15:00", "Home", "4-3-3", 0, 2,
     "Off day. Press was disorganized in second half. Need a dedicated session on pressing triggers.",
     []),
    ("Hillcrest Academy",  "14:00", "Away", "4-3-3", 2, 1,
     "Good character shown after going behind early. High press won us the ball for both goals.",
     [("Goal", 9, 38), ("Assist", 7, 38),
      ("Goal", 11, 71), ("Assist", 2, 71)]),
    ("Lakeside Academy",   "14:00", "Home", "4-3-3", 3, 0,
     "Clean sheet. Zonal corner defense worked perfectly. All 3 goals came from counter-attacks within 5 seconds.",
     [("Goal", 9, 14),  ("Assist", 8, 14),
      ("Goal", 11, 41), ("Assist", 9, 41),
      ("Goal", 12, 72)]),
    ("Bridgewater FC",     "11:00", "Away", "4-3-3", 1, 0,
     "Narrow, hard-fought win. Compact shape held firm under late pressure. Resilient display away from home.",
     [("Goal", 9, 62), ("Assist", 6, 62)]),
]

ALL_SEASON_MATCHES = [MATCHES_SEASON_0, MATCHES_SEASON_1, MATCHES_SEASON_2]

OPPONENTS_BY_SEASON = [
    ["Riverside Athletic", "Northgate United", "Eastside FC", "Southbank Rovers",
     "Westfield City", "Hillcrest Academy", "Lakeside Academy", "Bridgewater FC"],
    ["Riverside Athletic", "Northgate United", "Eastside FC", "Southbank Rovers",
     "Westfield City", "Hillcrest Academy", "Lakeside Academy", "Bridgewater FC"],
    ["Riverside Athletic", "Northgate United", "Eastside FC", "Southbank Rovers",
     "Westfield City", "Hillcrest Academy", "Lakeside Academy", "Bridgewater FC",
     # Upcoming
     "Hilltop FC", "Central Park XI"],
]


# ---------------------------------------------------------------------------
# Training sessions
# ---------------------------------------------------------------------------

def seed_training_sessions(db, team_id: str, season_id: str,
                           player_ids: list, exercise_ids: list,
                           day_offset: int = 0) -> list:
    all_pl   = ",".join(player_ids)
    first_11 = ",".join(player_ids[:11])

    def ex(*indices):
        return ",".join(exercise_ids[i] for i in indices if i < len(exercise_ids))

    sessions = [
        TrainingSession(
            date=_ago(42, day_offset), start_time="16:00", end_time="17:30",
            focus="Season Opener — Fitness & Shape Introduction", intensity="Medium",
            team_id=team_id, season_id=season_id,
            selected_players=all_pl, selected_exercises=ex(0, 5),
        ),
        TrainingSession(
            date=_ago(35, day_offset), start_time="16:00", end_time="17:30",
            focus="Possession & Pressing Shape", intensity="Medium",
            team_id=team_id, season_id=season_id,
            selected_players=all_pl, selected_exercises=ex(0, 2),
        ),
        TrainingSession(
            date=_ago(28, day_offset), start_time="16:00", end_time="17:30",
            focus="Wide Overloads & Crossing", intensity="High",
            team_id=team_id, season_id=season_id,
            selected_players=",".join(player_ids[:14]), selected_exercises=ex(1, 2),
        ),
        TrainingSession(
            date=_ago(21, day_offset), start_time="16:30", end_time="18:00",
            focus="Pressing Triggers & Counter-Press", intensity="High",
            team_id=team_id, season_id=season_id,
            selected_players=",".join(player_ids[:13]), selected_exercises=ex(2, 3),
        ),
        TrainingSession(
            date=_ago(17, day_offset), start_time="16:00", end_time="17:30",
            focus="Transition & Counter-Attack", intensity="High",
            team_id=team_id, season_id=season_id,
            selected_players=first_11, selected_exercises=ex(3),
        ),
        TrainingSession(
            date=_ago(14, day_offset), start_time="16:00", end_time="17:30",
            focus="Set Pieces — Defending Corners & Free Kicks", intensity="Low",
            team_id=team_id, season_id=season_id,
            selected_players=all_pl, selected_exercises=ex(4),
        ),
        TrainingSession(
            date=_ago(10, day_offset), start_time="16:00", end_time="17:30",
            focus="Build-Up Play Through Lines", intensity="Medium",
            team_id=team_id, season_id=season_id,
            selected_players=all_pl, selected_exercises=ex(5, 0),
        ),
        TrainingSession(
            date=_ago(7, day_offset), start_time="16:00", end_time="17:30",
            focus="Match Prep — Tactical Shape vs Compact Block", intensity="Medium",
            team_id=team_id, season_id=season_id,
            selected_players=",".join(player_ids[:14]), selected_exercises=ex(0, 2, 3),
        ),
        TrainingSession(
            date=_ago(4, day_offset), start_time="17:00", end_time="18:30",
            focus="Match Prep — High Press vs Build-Up", intensity="High",
            team_id=team_id, season_id=season_id,
            selected_players=first_11, selected_exercises=ex(1, 2, 5),
        ),
        TrainingSession(
            date=_ago(2, day_offset), start_time="16:00", end_time="17:00",
            focus="Recovery — Light Activation & Rondos", intensity="Low",
            team_id=team_id, season_id=season_id,
            selected_players=",".join(player_ids[:13]), selected_exercises=ex(0),
        ),
    ]

    # Upcoming sessions only in the current season
    if day_offset == 0:
        sessions += [
            TrainingSession(
                date=_ahead(2), start_time="16:00", end_time="17:30",
                focus="Match Prep — Set Pieces & Pressing Review", intensity="Medium",
                team_id=team_id, season_id=season_id,
                selected_players=all_pl, selected_exercises=ex(2, 4),
            ),
            TrainingSession(
                date=_ahead(9), start_time="16:00", end_time="17:30",
                focus="Wide Channels & Crossing", intensity="High",
                team_id=team_id, season_id=season_id,
                selected_players=all_pl, selected_exercises=ex(1, 3),
            ),
        ]

    db.add_all(sessions)
    db.flush()
    print(f"  Training sessions seeded: {len(sessions)}")
    return sessions


# ---------------------------------------------------------------------------
# Matches
# ---------------------------------------------------------------------------

def seed_matches(db, team_id: str, season_id: str,
                 players: list, day_offset: int = 0,
                 season_index: int = 0) -> list:

    p_by_jersey = {p.jersey_number: p.id for p in players}
    lu = _make_lineup(players)

    # Pick the right dataset for this season (clamp to last if out of range)
    idx = min(season_index, len(ALL_SEASON_MATCHES) - 1)
    season_data = ALL_SEASON_MATCHES[idx]

    # Space 8 past matches evenly across the season window (56 days)
    match_dates = [_ago(56 - i * 7, day_offset) for i in range(len(season_data))]

    matches = []
    all_events = []
    all_ratings = []
    starter_ids = [p["player"]["id"] for p in json.loads(lu)]
    rng = random.Random(season_index)  # fixed seed so re-seeding gives the same ratings

    for i, (opponent, time_, location, formation, gf, ga, notes, events) in enumerate(season_data):
        m = Match(
            opponent=opponent,
            date=match_dates[i],
            time=time_,
            location=location,
            formation=formation,
            lineup=lu,
            team_id=team_id,
            season_id=season_id,
            goals_for=gf,
            goals_against=ga,
            notes=notes,
        )
        db.add(m)
        db.flush()
        matches.append(m)

        for ev_type, jersey, minute in events:
            player_id = p_by_jersey.get(jersey)
            if player_id:
                all_events.append(MatchEvent(
                    match_id=m.id,
                    player_id=player_id,
                    event_type=ev_type,
                    minute=minute,
                ))
        for player_id in starter_ids:
            all_ratings.append(MatchRating(match_id=m.id, player_id=player_id, rating=rng.randint(5, 9)))

    # Upcoming fixtures only for the current season
    if day_offset == 0:
        for opponent, days_ahead in [("Hilltop FC", 5), ("Central Park XI", 12)]:
            m = Match(
                opponent=opponent,
                date=_ahead(days_ahead),
                time="14:00",
                location="Away" if days_ahead == 5 else "Home",
                formation="4-3-3",
                lineup=lu,
                team_id=team_id,
                season_id=season_id,
                notes="",
            )
            db.add(m)
            matches.append(m)

    db.add_all(all_events)
    db.add_all(all_ratings)
    db.flush()

    past_count = len(season_data)
    upcoming_count = 2 if day_offset == 0 else 0
    print(f"  Matches seeded: {past_count + upcoming_count} ({past_count} past, {upcoming_count} upcoming), {len(all_events)} events, {len(all_ratings)} ratings")
    return matches


if __name__ == "__main__":
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if not user:
            print(f"Demo user '{DEMO_EMAIL}' not found. Run seed_demo.py first.")
        else:
            team      = db.query(Team).filter(Team.coach_id == user.id).first()
            seasons   = db.query(Season).filter(Season.coach_id == user.id).order_by(Season.created_at).all()
            players   = db.query(Player).filter(Player.coach_id == user.id).all()
            exercises = db.query(Exercise).filter(Exercise.coach_id == user.id).all()
            if not team or not seasons or not players:
                print("Team / seasons / players not found. Run seed_demo.py first.")
            else:
                player_ids   = [p.id for p in players]
                exercise_ids = [e.id for e in exercises]
                for i, season in enumerate(seasons):
                    offset = (len(seasons) - 1 - i) * 365
                    print(f"\nSeeding: {season.name}")
                    seed_training_sessions(db, team.id, season.id, player_ids, exercise_ids, offset)
                    seed_matches(db, team.id, season.id, players, offset, season_index=i)
                db.commit()
                print("Done.")
    finally:
        db.close()
