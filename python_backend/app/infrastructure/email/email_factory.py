"""Factory selecting the EmailSender by env var.

EMAIL_MODE=dev (default)  -> DevEmailSender (logs to /tmp/auri_emails/)
EMAIL_MODE=resend         -> ResendEmailSender (real API, RESEND_API_KEY required)
"""
from __future__ import annotations

import logging
import os

from app.application.ports.email_sender import EmailSender
from app.infrastructure.email.dev_email_sender import DevEmailSender
from app.infrastructure.email.resend_email_sender import (
    ResendEmailSender,
    from_env_default,
)


logger = logging.getLogger(__name__)


def create_email_sender() -> EmailSender:
    mode = os.getenv("EMAIL_MODE", "dev").lower()
    if mode == "resend":
        api_key = os.getenv("RESEND_API_KEY", "")
        if not api_key:
            logger.warning(
                "[Email] EMAIL_MODE=resend but RESEND_API_KEY missing — "
                "falling back to DevEmailSender"
            )
            return DevEmailSender()
        logger.info("[Email] Using ResendEmailSender")
        return ResendEmailSender(api_key=api_key, default_from=from_env_default())
    logger.info("[Email] Using DevEmailSender (EMAIL_MODE=dev)")
    return DevEmailSender()


def create_template_renderer():
    """Return a callable matching the application TemplateRenderer protocol.

    The application layer uses this as a function: renderer(name, context).
    Lives here because templates are infrastructure (presentation strings)."""
    from app.infrastructure.email.templates import render

    return render
