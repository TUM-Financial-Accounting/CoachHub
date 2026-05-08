# backend/email_service.py
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuration
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@coachhub.com")

# The frontend base URL (adjust as needed for production)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def send_reset_password_email(email: str, token: str):
    """Sends a password reset email or logs it if SMTP is not configured."""
    reset_link = f"{FRONTEND_URL}/?token={token}"
    
    subject = "CoachHub - Password Reset"
    body = f"""
    Hello,
    
    You have requested to reset your password for CoachHub.
    Please click the link below to set a new password:
    
    {reset_link}
    
    This link will expire in 1 hour.
    If you did not request this reset, please ignore this email.
    
    Best regards,
    The CoachHub Team
    """

    if not SMTP_HOST:
        print("\n" + "="*50)
        print("PRODUCTION WARNING: SMTP is not configured!")
        print(f"To: {email}")
        print(f"Subject: {subject}")
        print(f"Reset Link: {reset_link}")
        print("="*50 + "\n")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM
        msg['To'] = email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"Reset email sent successfully to {email}")
        return True
    except Exception as e:
        print(f"Error sending email to {email}: {e}")
        # In a real app, you might want to log this or re-raise
        return False
