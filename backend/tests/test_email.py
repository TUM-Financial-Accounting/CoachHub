import logging

import pytest

import config
import email_service


@pytest.mark.parametrize("raw, expected", [
    ("http://localhost:5173", "http://localhost:5173"),
    ("https://coachhub.app/", "https://coachhub.app"),
    ("  coachhub.up.railway.app/ ", "https://coachhub.up.railway.app"),
])
def test_frontend_url_is_normalised(raw, expected):
    assert config.normalize_frontend_url(raw) == expected


def test_without_a_provider_the_link_is_logged(monkeypatch, caplog):
    monkeypatch.setattr(config, "RESEND_API_KEY", "")
    monkeypatch.setattr(config, "SMTP_HOST", "")
    monkeypatch.setattr(config, "FRONTEND_URL", "https://coachhub.app")
    with caplog.at_level(logging.WARNING, logger="email_service"):
        assert email_service.send_reset_password_email("c@x", "tok123") is True
    assert "Reset Link: https://coachhub.app/?token=tok123" in caplog.text


def test_resend_is_preferred_and_gets_the_full_message(monkeypatch):
    sent = []
    monkeypatch.setattr(config, "RESEND_API_KEY", "key")
    monkeypatch.setattr(config, "FRONTEND_URL", "https://coachhub.app")
    monkeypatch.setattr(email_service, "_send_via_resend", lambda to, subject, body: sent.append((to, subject, body)) or True)
    monkeypatch.setattr(email_service, "_send_via_smtp", lambda *a: pytest.fail("SMTP must not be used"))

    assert email_service.send_verification_email("c@x", "v1") is True
    to, subject, body = sent[0]
    assert (to, subject) == ("c@x", "CoachHub - Verify your email")
    assert "https://coachhub.app/?verify_token=v1" in body


def test_smtp_is_the_fallback(monkeypatch):
    sent = []
    monkeypatch.setattr(config, "RESEND_API_KEY", "")
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example")
    monkeypatch.setattr(email_service, "_send_via_smtp", lambda to, subject, body: sent.append(subject) or True)
    assert email_service.send_reset_password_email("c@x", "t") is True
    assert sent == ["CoachHub - Password Reset"]
