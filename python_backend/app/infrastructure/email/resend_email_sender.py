"""Resend email sender — production transactional email.

EMAIL_MODE=resend selects this. Catches every exception and logs it without
raising — email failure must NEVER cascade into a business failure (NFR-7)."""
from __future__ import annotations

import logging
import os
from typing import Optional

from app.application.ports.email_sender import EmailSender


logger = logging.getLogger(__name__)


class ResendEmailSender(EmailSender):
    def __init__(
        self,
        *,
        api_key: str,
        default_from: str,
    ) -> None:
        self.api_key = api_key
        self.default_from = default_from
        # Lazy-imported in send() so the module imports even when the
        # `resend` package isn't installed (dev mode doesn't need it).

    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str,
        from_email: Optional[str] = None,
    ) -> None:
        try:
            import resend  # type: ignore[import-untyped]
        except ImportError:
            logger.warning("[ResendEmail] resend package not installed — skipping send")
            return

        try:
            resend.api_key = self.api_key
            params: dict = {
                "from": from_email or self.default_from,
                "to": [to],
                "subject": subject,
                "html": html,
                "text": text,
            }
            # Resend's Python SDK is synchronous as of v2.x — running it inline
            # is acceptable since transactional emails are infrequent + best-effort.
            resend.Emails.send(params)
            logger.info(f"[ResendEmail] sent to={to} subject={subject!r}")
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[ResendEmail] send failed for to={to} subject={subject!r}: {e}"
            )


def from_env_default() -> str:
    return os.getenv("AURI_FROM_EMAIL", "noreply@auri.local")
