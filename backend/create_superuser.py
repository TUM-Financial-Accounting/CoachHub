import argparse
import getpass
import sys

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import func, text
import database, models, security


def main():
    parser = argparse.ArgumentParser(description="Create or promote a CoachHub superuser.")
    parser.add_argument("email", help="Email address of the superuser account")
    parser.add_argument("--name", default=None, help="Full name (only when creating a new account)")
    parser.add_argument("--promote", action="store_true",
                        help="Promote an existing account instead of creating a new one")
    args = parser.parse_args()
    email = args.email.strip().lower()

    models.Base.metadata.create_all(bind=database.engine)
    with database.engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'coach'"))

    db = database.SessionLocal()
    try:
        user = db.query(models.User).filter(func.lower(models.User.email) == email).first()

        if args.promote:
            if not user:
                sys.exit(f"No account found for {email} — drop --promote to create one.")
            if user.role == "superuser":
                print(f"{user.email} is already a superuser. Nothing to do.")
                return
            user.role = "superuser"
            db.commit()
            print(f"Promoted {user.email} to superuser.")
            return

        if user:
            sys.exit(f"An account for {email} already exists — use --promote to make it a superuser.")

        password = getpass.getpass("Password for the new superuser: ")
        confirm = getpass.getpass("Repeat password: ")
        if password != confirm:
            sys.exit("Passwords do not match.")
        if len(password) < 8:
            sys.exit("Password must be at least 8 characters.")

        db.add(models.User(
            email=email,
            password=security.get_password_hash(password),
            full_name=args.name,
            is_verified=True,
            role="superuser",
        ))
        db.commit()
        print(f"Superuser {email} created. Log in through the normal login page.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
