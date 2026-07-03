"""Submit a waitlist signup from the public landing page.

Builds a Spanish notification email and routes it through the EmailSender
port. Keeps the application layer transport-agnostic — selection between
DevEmailSender and ResendEmailSender happens in the infrastructure factory."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from app.application.ports.email_sender import EmailSender


@dataclass(frozen=True)
class SubmitWaitlistResult:
    success: bool
    message: str


class SubmitWaitlistUseCase:
    def __init__(
        self,
        *,
        email_sender: EmailSender,
        destination_email: str,
        from_email: Optional[str] = None,
    ) -> None:
        self._sender = email_sender
        self._destination = destination_email
        self._from = from_email

    async def execute(
        self,
        *,
        email: str,
        source: str = "landing",
    ) -> SubmitWaitlistResult:
        timestamp = _format_timestamp_ar(datetime.now(timezone.utc))
        subject = f"Nueva solicitud de beta · {email}"
        html, text = _build_body(email=email, source=source, timestamp=timestamp)

        await self._sender.send(
            to=self._destination,
            subject=subject,
            html=html,
            text=text,
            from_email=self._from,
        )

        return SubmitWaitlistResult(
            success=True,
            message="Recibido. Te contactamos por email pronto.",
        )


def _format_timestamp_ar(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def _build_body(*, email: str, source: str, timestamp: str) -> tuple[str, str]:
    html = (
        "<h2>Nueva solicitud de beta de Susurra</h2>"
        f"<p><strong>Email:</strong> {email}</p>"
        f"<p><strong>Origen:</strong> {source}</p>"
        f"<p><strong>Recibido:</strong> {timestamp}</p>"
        "<hr>"
        "<p style=\"color: #888; font-size: 12px;\">"
        "Para aceptarlo: crea las credenciales y envíaselas. "
        "Reply directamente a este email para contactar."
        "</p>"
    )
    text = (
        "Nueva solicitud de beta de Susurra\n\n"
        f"Email: {email}\n"
        f"Origen: {source}\n"
        f"Recibido: {timestamp}\n\n"
        "Para aceptarlo: crea las credenciales y envíaselas. "
        "Reply directamente a este email para contactar.\n"
    )
    return html, text
