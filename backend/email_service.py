# backend/email_service.py
import json
import logging
import smtplib
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import config

logger = logging.getLogger(__name__)


def _send_via_resend(to: str, subject: str, text_body: str) -> bool:
    """Send an email via Resend's HTTP API. Returns True on success."""
    payload = json.dumps({
        "from": config.RESEND_FROM,
        "to": [to],
        "subject": subject,
        "text": text_body,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {config.RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "CoachHub/1.0 (+https://coachhub.local)",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if 200 <= resp.status < 300:
                logger.info("Resend: email sent to %s (status %s)", to, resp.status)
                return True
            logger.warning("Resend: unexpected status %s sending to %s", resp.status, to)
            return False
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.warning("Resend HTTPError %s sending to %s: %s", e.code, to, body)
        return False
    except Exception as e:
        logger.warning("Resend send failed for %s: %s", to, e)
        return False


def _send_via_smtp(to: str, subject: str, text_body: str) -> bool:
    try:
        msg = MIMEMultipart()
        msg['From'] = config.SMTP_FROM
        msg['To'] = to
        msg['Subject'] = subject
        msg.attach(MIMEText(text_body, 'plain'))

        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as server:
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info("Email '%s' sent to %s", subject, to)
        return True
    except Exception as e:
        logger.warning("Error sending '%s' to %s: %s", subject, to, e)
        return False


def _send(to: str, subject: str, body: str, link_label: str, link: str) -> bool:
    """Resend if configured, else SMTP; with neither, the link goes to the server log."""
    if config.RESEND_API_KEY:
        return _send_via_resend(to, subject, body)

    if not config.SMTP_HOST:
        logger.warning(
            "\n%s\nPRODUCTION WARNING: No email provider configured!\nTo: %s\nSubject: %s\n%s: %s\n%s",
            "=" * 50, to, subject, link_label, link, "=" * 50,
        )
        return True

    return _send_via_smtp(to, subject, body)


def send_verification_email(email: str, token: str):
    """Sends an account verification email or logs it if no provider is configured."""
    verify_link = f"{config.FRONTEND_URL}/?verify_token={token}"
    body = f"""
    Welcome to CoachHub!

    Please verify your email address by clicking the link below:

    {verify_link}

    This link will expire in 24 hours.
    If you did not sign up, you can safely ignore this email.

    Best regards,
    The CoachHub Team
    """
    return _send(email, "CoachHub - Verify your email", body, "Verification Link", verify_link)


def send_reset_password_email(email: str, token: str):
    """Sends a password reset email or logs it if no provider is configured."""
    reset_link = f"{config.FRONTEND_URL}/?token={token}"
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
    return _send(email, "CoachHub - Password Reset", body, "Reset Link", reset_link)
