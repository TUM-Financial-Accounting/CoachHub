"""
Demo seed data for CoachHub.

Creates one coach account with two seasons, two squads, a populated exercise
library, recurring training series with materialised occurrences, played
matches with goals/assists (so the statistics views have real data), upcoming
fixtures, and calendar events.

    cd backend
    python seed.py            # seed (refuses if the demo account already exists)
    python seed.py --reset    # delete the demo coach's data first, then re-seed

--reset only ever touches rows belonging to the demo account. It never drops
tables and never touches other users' data.

Login after seeding:  demo@coachhub.app  /  demo1234
"""

import os
import random
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from passlib.context import CryptContext  # noqa: E402

import database  # noqa: E402
import models  # noqa: E402

# Same scheme as backend/security.py — importing security here would require
# SECRET_KEY to be set just to seed, which is an unhelpful failure mode.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_EMAIL = "demo@coachhub.app"
DEMO_PASSWORD = "demo1234"
DEMO_NAME = "Demo Coach"

TODAY = date.today()
# Football seasons run summer-to-summer.
if TODAY.month >= 7:
    CURRENT_SEASON, PREVIOUS_SEASON = f"{TODAY.year}/{TODAY.year + 1}", f"{TODAY.year - 1}/{TODAY.year}"
else:
    CURRENT_SEASON, PREVIOUS_SEASON = f"{TODAY.year - 1}/{TODAY.year}", f"{TODAY.year - 2}/{TODAY.year - 1}"


# --------------------------------------------------------------- squad data
U15_SQUAD = [
    ("Jonas", "Berger", "Goalkeeper", 1, 4), ("Lukas", "Wagner", "Goalkeeper", 12, 3),
    ("Felix", "Hoffmann", "Defender", 2, 4), ("Elias", "Schröder", "Defender", 3, 5),
    ("Noah", "Keller", "Defender", 4, 3), ("Ben", "Zimmermann", "Defender", 5, 4),
    ("Paul", "Brandt", "Defender", 6, 3), ("Emil", "Krüger", "Midfielder", 8, 5),
    ("Anton", "Lehmann", "Midfielder", 10, 5), ("Theo", "Vogel", "Midfielder", 14, 4),
    ("Moritz", "Frank", "Midfielder", 16, 3), ("Julian", "Böhm", "Midfielder", 18, 4),
    ("Leon", "Sommer", "Forward", 9, 5), ("Matteo", "Roth", "Forward", 7, 4),
    ("David", "Engel", "Forward", 11, 4), ("Samuel", "Kaiser", "Forward", 19, 3),
]

U17_SQUAD = [
    ("Tim", "Baumann", "Goalkeeper", 1, 4), ("Nils", "Ackermann", "Goalkeeper", 21, 3),
    ("Jakob", "Winkler", "Defender", 2, 5), ("Luis", "Hartmann", "Defender", 4, 4),
    ("Fabian", "Schuster", "Defender", 5, 4), ("Marlon", "Peters", "Defender", 3, 3),
    ("Niklas", "Busch", "Midfielder", 6, 5), ("Jannik", "Albrecht", "Midfielder", 8, 4),
    ("Simon", "Voigt", "Midfielder", 10, 5), ("Tobias", "Ludwig", "Midfielder", 15, 3),
    ("Maximilian", "Otto", "Forward", 9, 5), ("Henri", "Seidel", "Forward", 7, 4),
    ("Erik", "Walter", "Forward", 11, 3), ("Aaron", "Fuchs", "Forward", 17, 4),
]

TRIALISTS = [
    ("Milan", "Novak", "Midfielder", "SV Grünwald", 4,
     "Strong first touch, reads the game well. Needs work defensively. Worth a second look."),
    ("Yusuf", "Demir", "Forward", "TSV Ottobrunn", 5,
     "Quick, direct, finishes with both feet. Best trialist this season — sign him."),
    ("Oskar", "Lang", "Defender", "FC Deisenhofen", 3,
     "Composed on the ball but lacks pace against quick forwards. Keep watching."),
]

EXERCISES = [
    ("Rondo 5v2", "technique", "Medium",
     "Five players in a circle, two defenders in the middle. One touch only.",
     "10x10m grid, 7 players, one ball", "Two-touch for younger groups; add a third defender to progress.",
     "Body shape before receiving. Head up. Play the pass that breaks the line."),
    ("Passing Diamond", "technique", "Low",
     "Four cones in a diamond. Pass and follow, alternating direction on the coach's call.",
     "15x15m diamond, 8 players, two balls", "Add a one-two at each corner.",
     "Weight of pass. Receive across the body. Communicate before the ball arrives."),
    ("4v4 Transition Game", "game form", "High",
     "Two teams of four. On turnover the ball must reach the far zone within five seconds.",
     "30x20m pitch, four small goals", "Add two neutral players to overload the team in possession.",
     "React the instant possession changes. First pass forward if it's on."),
    ("Pressing Triggers", "tactical", "High",
     "Shadow play. The back pass is the trigger — the whole unit steps up together.",
     "Half pitch, 11 players, mannequins", "Progress to live opposition at 60% intensity.",
     "Press as a unit, never alone. Cut the passing lane, then close the man."),
    ("Build-Up From The Keeper", "tactical", "Medium",
     "Goalkeeper plays out under pressure from two forwards. Centre-backs split.",
     "Defensive third, 9 players", "Add a third presser to force the long option.",
     "Angles, not distance. Keeper is always an option to go back to."),
    ("Finishing Under Pressure", "technique", "High",
     "Striker receives with back to goal, turns, finishes with a defender closing.",
     "Penalty area, servers on both flanks", "Two-touch limit; then first-time finishes only.",
     "Check away before checking in. Shoot across the keeper."),
    ("Speed Ladder Circuit", "athletic", "High",
     "Four stations: ladder, hurdles, sprint, change of direction. 30s work, 30s rest.",
     "Ladders, mini hurdles, cones", "Add a ball at the final station.",
     "Quality over speed early. Land soft, drive the arms."),
    ("Small-Sided 7v7", "game form", "High",
     "Full game in a reduced area. Free play, coach observes only.",
     "50x40m pitch, two goals", "Condition it: two-touch, or goals only from inside the box.",
     "Let them play. Coach in the breaks, not during."),
    ("Defensive Shape 4-4-2", "tactical", "Medium",
     "Back eight hold shape while the ball is moved around the attacking third.",
     "Half pitch, mannequins", "Add live forwards to punish gaps.",
     "Distance between the lines. Shuffle, don't chase."),
    ("Recovery Session", "athletic", "Low",
     "Light jog, mobility work, and stretching the day after a match.",
     "Full pitch, mats", "Add pool work if available.",
     "Conversation pace throughout. This is recovery, not training."),
]

BASICS = [
    ("First Touch", "Receiving the ball into space, away from pressure, with the correct surface."),
    ("Passing Technique", "Inside-foot accuracy over short distances; laces for driven passes."),
    ("Body Shape", "Opening up before the ball arrives so the next action is already available."),
    ("Heading", "Attacking the ball with the forehead, eyes open, from a stable base."),
    ("1v1 Defending", "Approach, slow down, show the attacker onto their weaker side."),
]

PRINCIPLES = [
    ("Play Forward First", "In Possession",
     "Always look for the forward pass before the safe sideways one.",
     "Reward the attempt, not just the completion — at youth level the habit matters more than the success rate."),
    ("Compact Defensive Block", "Out of Possession",
     "Keep no more than 25 metres between the defensive and midfield lines.",
     "Use a rope in training to make the distance visible."),
    ("Counter-Press", "Transition",
     "Win the ball back within six seconds of losing it, closest player presses first.",
     "Only works if the whole unit reacts together — one presser is worse than none."),
    ("Width in Attack", "In Possession",
     "Wingers stay high and wide until the ball is ready to be delivered.",
     "Mark the touchline channel with cones early in the session."),
]

TACTICS = [
    ("4-3-3 High Press", "4-3-3",
     "Aggressive front three pressing the centre-backs, midfield stepping up to cover.",
     "Pressing Triggers, 4v4 Transition Game"),
    ("4-4-2 Mid Block", "4-4-2",
     "Two banks of four holding a compact middle third, inviting the opponent forward.",
     "Defensive Shape 4-4-2, Small-Sided 7v7"),
    ("3-5-2 Wing-Backs", "3-5-2",
     "Wing-backs provide all the width; three centre-backs cover the space behind.",
     "Width in Attack, Build-Up From The Keeper"),
]

PAST_MATCHES = [
    ("FC Ismaning", 3, 1, "Home", "4-3-3"),
    ("TSV Ottobrunn", 2, 2, "Away", "4-3-3"),
    ("SV Grünwald", 1, 0, "Home", "4-4-2"),
    ("FC Deisenhofen", 0, 2, "Away", "4-4-2"),
    ("SpVgg Unterhaching", 4, 2, "Home", "4-3-3"),
    ("TSV Neuried", 2, 3, "Away", "3-5-2"),
]

UPCOMING_MATCHES = [
    ("FC Kirchheim", "Home", "4-3-3", 6),
    ("SV Pullach", "Away", "4-3-3", 13),
    ("TSV Solln", "Home", "4-4-2", 20),
]


def wipe_demo_data(db, user):
    """Remove every row belonging to the demo coach, in FK-safe order."""
    team_ids = [t.id for t in db.query(models.Team).filter(models.Team.coach_id == user.id).all()]
    player_ids = [p.id for p in db.query(models.Player).filter(models.Player.coach_id == user.id).all()]

    # ORM delete so Match.events cascades.
    for match in db.query(models.Match).filter(models.Match.team_id.in_(team_ids or [""])).all():
        db.delete(match)
    if player_ids:
        db.query(models.MatchEvent).filter(models.MatchEvent.player_id.in_(player_ids)).delete(synchronize_session=False)
        db.query(models.MatchRating).filter(models.MatchRating.player_id.in_(player_ids)).delete(synchronize_session=False)

    db.query(models.TrainingSession).filter(models.TrainingSession.team_id.in_(team_ids or [""])).delete(synchronize_session=False)
    db.query(models.TrainingSeries).filter(models.TrainingSeries.coach_id == user.id).delete(synchronize_session=False)
    db.query(models.Event).filter(models.Event.coach_id == user.id).delete(synchronize_session=False)
    db.query(models.EventSeries).filter(models.EventSeries.coach_id == user.id).delete(synchronize_session=False)
    db.query(models.TeamPlayer).filter(models.TeamPlayer.team_id.in_(team_ids or [""])).delete(synchronize_session=False)
    db.query(models.Team).filter(models.Team.coach_id == user.id).delete(synchronize_session=False)
    db.query(models.Player).filter(models.Player.coach_id == user.id).delete(synchronize_session=False)

    for model in (models.Exercise, models.Basic, models.Principle, models.Tactic,
                  models.CustomFormation, models.Vision, models.FeedbackRequest):
        db.query(model).filter(model.coach_id == user.id).delete(synchronize_session=False)

    db.query(models.Season).filter(models.Season.coach_id == user.id).delete(synchronize_session=False)
    db.commit()


def make_players(db, squad, coach_id, birth_year):
    players = []
    for i, (first, last, position, number, _perf) in enumerate(squad):
        p = models.Player(
            coach_id=coach_id, first_name=first, last_name=last, position=position,
            jersey_number=number, status="Active",
            date_of_birth=f"{birth_year}-{(i % 12) + 1:02d}-{(i % 27) + 1:02d}",
            height=155 + (i * 3) % 30, weight=45.0 + (i * 1.7) % 20,
            clothing_size=["S", "M", "L"][i % 3],
            strong_foot=["Right", "Right", "Left", "Both"][i % 4],
            mother_name=f"Frau {last}", mother_phone=f"+49 170 {1000000 + i * 137}",
            father_name=f"Herr {last}", father_phone=f"+49 171 {2000000 + i * 211}",
            attendance=75 + (i * 5) % 25,
        )
        db.add(p)
        players.append(p)
    db.flush()
    return players


def materialise_series(db, series, team_id, season_id, player_ids, exercise_ids):
    """Expand a series into TrainingSession rows — mirrors POST /training_series."""
    offset = (series.day_of_week - series.series_start_date.weekday()) % 7
    occurrence = series.series_start_date + timedelta(days=offset)
    created = 0
    while occurrence <= series.series_end_date and created < 200:
        db.add(models.TrainingSession(
            team_id=team_id, season_id=season_id, date=occurrence,
            start_time=series.start_time, end_time=series.end_time,
            focus=series.focus, intensity=series.intensity,
            selected_players=",".join(player_ids),
            selected_exercises=",".join(exercise_ids),
            series_id=series.id, is_modified=False,
        ))
        occurrence += timedelta(days=7)
        created += 1
    return created


def seed(reset=False):
    models.Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()

    try:
        user = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()

        if user and not reset:
            print(f"Demo account {DEMO_EMAIL} already exists.")
            print("Run 'python seed.py --reset' to wipe its data and re-seed.")
            return

        if user:
            print(f"Resetting data for {DEMO_EMAIL}...")
            wipe_demo_data(db, user)
        else:
            user = models.User(
                email=DEMO_EMAIL, password=pwd_context.hash(DEMO_PASSWORD),
                full_name=DEMO_NAME, is_verified=True,
            )
            db.add(user)
            db.flush()

        # --- seasons -------------------------------------------------------
        current = models.Season(coach_id=user.id, name=CURRENT_SEASON)
        previous = models.Season(coach_id=user.id, name=PREVIOUS_SEASON)
        db.add_all([current, previous])
        db.flush()

        # --- libraries -----------------------------------------------------
        for name, desc in BASICS:
            db.add(models.Basic(coach_id=user.id, name=name, description=desc))

        for name, phase, desc, notes in PRINCIPLES:
            db.add(models.Principle(coach_id=user.id, name=name, game_phase=phase,
                                    description=desc, coaching_notes=notes,
                                    implementation_tips="Introduce in small-sided games first."))

        for name, formation, desc, drills in TACTICS:
            db.add(models.Tactic(coach_id=user.id, name=name, formation=formation,
                                 description=desc, suggested_drills=drills))

        exercises = []
        for name, category, intensity, desc, setup, variations, points in EXERCISES:
            e = models.Exercise(
                coach_id=user.id, name=name, category=category, intensity=intensity,
                description=desc, setup=setup, variations=variations,
                coaching_points=points, goalkeepers=1 if "Keeper" in name else 0,
                equipment="Cones, bibs, balls",
                linked_tactics="4-3-3 High Press" if category == "tactical" else None,
            )
            db.add(e)
            exercises.append(e)
        db.flush()
        ex_ids = [e.id for e in exercises]

        # --- teams and squads ----------------------------------------------
        u15 = models.Team(coach_id=user.id, name="U15", formation="4-3-3", season_id=current.id)
        u17 = models.Team(coach_id=user.id, name="U17", formation="4-4-2", season_id=current.id)
        u15_last = models.Team(coach_id=user.id, name="U15", formation="4-4-2", season_id=previous.id)
        db.add_all([u15, u17, u15_last])
        db.flush()

        u15_players = make_players(db, U15_SQUAD, user.id, TODAY.year - 15)
        u17_players = make_players(db, U17_SQUAD, user.id, TODAY.year - 17)

        for player, (_, _, _, _, perf) in zip(u15_players, U15_SQUAD):
            db.add(models.TeamPlayer(team_id=u15.id, player_id=player.id,
                                     season_id=current.id, performance=perf))
            # Same players last season, rated differently — shows per-team ratings.
            db.add(models.TeamPlayer(team_id=u15_last.id, player_id=player.id,
                                     season_id=previous.id, performance=max(1, perf - 1)))

        for player, (_, _, _, _, perf) in zip(u17_players, U17_SQUAD):
            db.add(models.TeamPlayer(team_id=u17.id, player_id=player.id,
                                     season_id=current.id, performance=perf))

        # --- trial players ---------------------------------------------------
        for first, last, position, club, rating, notes in TRIALISTS:
            db.add(models.Player(
                coach_id=user.id, first_name=first, last_name=last, position=position,
                jersey_number=0, status="Active", date_of_birth=f"{TODAY.year - 15}-04-12",
                is_trial=True, home_club=club, trial_rating=rating, trial_notes=notes,
            ))
        db.flush()

        # --- recurring training ----------------------------------------------
        u15_ids = [p.id for p in u15_players]
        u17_ids = [p.id for p in u17_players]
        series_start = TODAY - timedelta(weeks=8)
        series_end = TODAY + timedelta(weeks=12)
        total_sessions = 0

        for team, ids, weekday, focus, intensity, start, end in [
            (u15, u15_ids, 1, "Possession & Pressing", "High", "17:30", "19:00"),
            (u15, u15_ids, 3, "Finishing & Transition", "Medium", "17:30", "19:00"),
            (u17, u17_ids, 2, "Defensive Shape", "Medium", "19:00", "20:30"),
        ]:
            s = models.TrainingSeries(
                coach_id=user.id, team_id=team.id, season_id=current.id,
                day_of_week=weekday, series_start_date=series_start, series_end_date=series_end,
                start_time=start, end_time=end, focus=focus, intensity=intensity,
                selected_players=",".join(ids), selected_exercises=",".join(ex_ids[:4]),
            )
            db.add(s)
            db.flush()
            total_sessions += materialise_series(db, s, team.id, current.id, ids, ex_ids[:4])

        # --- matches ----------------------------------------------------------
        scorers = [p for p in u15_players if p.position in ("Forward", "Midfielder")]
        rng = random.Random(15)  # fixed seed so the demo ratings are the same on every reset
        for i, (opponent, gf, ga, venue, formation) in enumerate(PAST_MATCHES):
            match = models.Match(
                team_id=u15.id, season_id=current.id, opponent=opponent,
                date=TODAY - timedelta(days=(len(PAST_MATCHES) - i) * 7 + 1),
                time="11:00", location=venue, formation=formation,
                goals_for=gf, goals_against=ga,
                notes="Good intensity in the first half." if gf > ga else "Dropped off after the break.",
            )
            db.add(match)
            db.flush()
            # Goals and assists so the statistics views and leaderboards populate.
            for g in range(gf):
                scorer = scorers[(i * 3 + g) % len(scorers)]
                assister = scorers[(i * 3 + g + 2) % len(scorers)]
                db.add(models.MatchEvent(match_id=match.id, player_id=scorer.id,
                                         event_type="Goal", minute=10 + (g * 17) % 80))
                if assister.id != scorer.id:
                    db.add(models.MatchEvent(match_id=match.id, player_id=assister.id,
                                             event_type="Assist", minute=10 + (g * 17) % 80))
            # Per-match ratings so the season report has averages and MVPs.
            for p in u15_players[:11]:
                db.add(models.MatchRating(match_id=match.id, player_id=p.id, rating=rng.randint(5, 9)))

        for opponent, venue, formation, days in UPCOMING_MATCHES:
            db.add(models.Match(
                team_id=u15.id, season_id=current.id, opponent=opponent,
                date=TODAY + timedelta(days=days), time="11:00",
                location=venue, formation=formation,
            ))

        # --- calendar events ---------------------------------------------------
        for title, desc, days, start, end in [
            ("Parents' Evening", "Season plan and travel arrangements.", 4, "19:00", "20:30"),
            ("Team Photo", "Full kit, arrive 15 minutes early.", 11, "16:00", "17:00"),
            ("Coaches' Meeting", "Mid-season review with the club.", 18, "18:00", "19:30"),
        ]:
            db.add(models.Event(
                coach_id=user.id, team_id=u15.id, season_id=current.id,
                title=title, description=desc, location="Clubhouse",
                date=TODAY + timedelta(days=days), start_time=start, end_time=end,
            ))

        db.commit()

        print("\nSeeded successfully.\n")
        print(f"  Login          {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print(f"  Seasons        {CURRENT_SEASON} (current), {PREVIOUS_SEASON}")
        print(f"  Teams          U15 ({len(u15_players)}), U17 ({len(u17_players)}), U15 {PREVIOUS_SEASON}")
        print(f"  Trialists      {len(TRIALISTS)}")
        print(f"  Exercises      {len(EXERCISES)}   Basics {len(BASICS)}  Principles {len(PRINCIPLES)}  Tactics {len(TACTICS)}")
        print(f"  Training       3 series, {total_sessions} sessions ({series_start} to {series_end})")
        print(f"  Matches        {len(PAST_MATCHES)} played (with goals/assists), {len(UPCOMING_MATCHES)} upcoming")
        print()

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
