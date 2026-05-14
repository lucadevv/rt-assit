"""Dev email sender — logs + writes to /tmp/auri_emails/.

EMAIL_MODE=dev selects this. Never reaches the network. Useful for verifying
template rendering and seeing what the user would receive."""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Optional

from app.application.ports.email_sender import EmailSender


logger = logging.getLogger(__name__)


class DevEmailSender(EmailSender):
    def __init__(
        self, *, output_dir: str = "/tmp/auri_emails"
    ) -> None:
        self.output_dir = Path(output_dir)

    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str,
        from_email: Optional[str] = None,
    ) -> None:
        from_email = from_email or os.getenv(
            "AURI_FROM_EMAIL", "noreply@auri.local"
        )
        try:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            ts = int(time.time() * 1000)
            safe_to = to.replace("/", "_").replace("@", "_at_")
            path = self.output_dir / f"{ts}_{safe_to}.txt"
            path.write_text(
                f"From: {from_email}\nTo: {to}\nSubject: {subject}\n\n"
                f"--- TEXT ---\n{text}\n\n--- HTML ---\n{html}\n",
                encoding="utf-8",
            )
        except Exception as e:  # noqa: BLE001 — best-effort log
            logger.warning(f"[DevEmail] failed to write file: {e}")

        # One-line summary on the logs.
        preview = (text or "")[:80].replace("\n", " ")
        logger.info(
            f"[DevEmail] to={to} subject={subject!r} body={preview!r}"
        )
