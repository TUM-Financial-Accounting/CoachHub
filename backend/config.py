import os


def normalize_frontend_url(value: str) -> str:
    # Same rules as the CORS origin in main.py: trimmed, no trailing slash, scheme added.
    url = (value or "").strip().rstrip("/")
    if url and not url.startswith("http"):
        url = "https://" + url
    return url


FRONTEND_URL = normalize_frontend_url(os.getenv("FRONTEND_URL", "http://localhost:5173"))

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM", "CoachHub <onboarding@resend.dev>")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT") or 587)
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@coachhub.com")
