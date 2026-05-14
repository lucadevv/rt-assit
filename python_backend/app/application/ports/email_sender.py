"""Email sender port (B5 — Billing/transactional emails).

Multi-impl: ResendEmailSender (production) + DevEmailSender (logs to console
+ files). Selected via EMAIL_MODE env var."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class EmailSender(ABC):
    @abstractmethod
    async def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str,
        from_email: Optional[str] = None,
    ) -> None:
        """Best-effort send. Implementations handle their own retry/log."""
        ...
