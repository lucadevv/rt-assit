"""Transactional email use cases (B5 — Billing).

Each use case loads the matching template from the in-process catalog
(infrastructure/email/templates.py) and sends via the EmailSender port.
Templates are Spanish-first (NFR-21). Plain-text + HTML versions both included."""
from __future__ import annotations

import logging
from typing import Any, Optional

from app.application.ports.email_sender import EmailSender


logger = logging.getLogger(__name__)


# Templates module is in infrastructure (string templates aren't business logic).
# We import the renderer lazily via the EmailRenderer port… actually for simplicity
# we register a callable on construction. Each "Send*EmailUseCase" stays in
# application/ as it owns the orchestration; the rendering itself is just
# str.format on hardcoded constants in infrastructure/email/templates.py and is
# acceptable to call from the use case via a lightweight TemplateRenderer port-
# like callable (see _Renderer below) to keep imports clean.


class TemplateRenderer:
    """Function shape: render(name, context) -> (subject, html, text)."""

    def __call__(self, name: str, context: dict[str, Any]) -> tuple[str, str, str]:
        ...


class _BaseSendEmail:
    template_name: str = ""

    def __init__(
        self, *, sender: EmailSender, renderer: TemplateRenderer
    ) -> None:
        self.sender = sender
        self.renderer = renderer

    async def _send(
        self,
        *,
        to: str,
        context: dict[str, Any],
        from_email: Optional[str] = None,
    ) -> None:
        if not to:
            logger.warning(
                f"[Email] Skipping {self.template_name} — empty recipient"
            )
            return
        subject, html, text = self.renderer(self.template_name, context)
        try:
            await self.sender.send(
                to=to,
                subject=subject,
                html=html,
                text=text,
                from_email=from_email,
            )
        except Exception as e:  # noqa: BLE001 — best effort
            logger.warning(
                f"[Email] failed to send {self.template_name} to {to}: {e}"
            )


class SendWelcomeEmailUseCase(_BaseSendEmail):
    template_name = "welcome"

    async def execute(self, *, to: str, name: Optional[str]) -> None:
        await self._send(to=to, context={"name": name or "amigo"})


class SendTrialExpiringEmailUseCase(_BaseSendEmail):
    template_name = "trial_expiring"

    async def execute(self, *, to: str, name: Optional[str], hours_left: int) -> None:
        await self._send(
            to=to,
            context={"name": name or "amigo", "hours_left": hours_left},
        )


class SendInvoicePaidEmailUseCase(_BaseSendEmail):
    template_name = "invoice_paid"

    async def execute(
        self,
        *,
        to: str,
        amount_cents: int,
        currency: str,
        invoice_url: Optional[str],
    ) -> None:
        await self._send(
            to=to,
            context={
                "amount": f"{amount_cents/100:.2f}",
                "currency": currency,
                "invoice_url": invoice_url or "",
            },
        )


class SendPaymentFailedEmailUseCase(_BaseSendEmail):
    template_name = "payment_failed"

    async def execute(self, *, to: str, retry_url: str) -> None:
        await self._send(to=to, context={"retry_url": retry_url})


class SendDunningEmailUseCase(_BaseSendEmail):
    template_name = "dunning"

    async def execute(self, *, to: str, attempt: int, retry_url: str) -> None:
        await self._send(
            to=to, context={"attempt": attempt, "retry_url": retry_url}
        )


class SendUsageWarningEmailUseCase(_BaseSendEmail):
    template_name = "usage_warning"

    async def execute(
        self, *, to: str, name: Optional[str], limit_name: str, percent: int
    ) -> None:
        await self._send(
            to=to,
            context={
                "name": name or "amigo",
                "limit_name": limit_name,
                "percent": percent,
            },
        )
