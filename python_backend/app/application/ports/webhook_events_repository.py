"""Repository port for webhook events (B5 — Billing).

Idempotency boundary (NFR-8): provider event id is the PK, INSERT OR IGNORE
on receive. Duplicates are dropped at the DB layer."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Optional

from app.domain.entities.webhook_event import WebhookEvent, WebhookStatus


class WebhookEventsRepository(ABC):
    @abstractmethod
    def insert_or_skip(
        self,
        *,
        event_id: str,
        provider: str,
        event_type: str,
        payload: dict[str, Any],
        signature: Optional[str],
    ) -> bool:
        """Insert a new event row. Returns True if inserted, False if duplicate."""
        ...

    @abstractmethod
    def get(self, event_id: str) -> Optional[WebhookEvent]:
        ...

    @abstractmethod
    def mark_processed(
        self, event_id: str, *, processed_at: datetime
    ) -> None:
        ...

    @abstractmethod
    def mark_failed(
        self, event_id: str, *, error_message: str
    ) -> None:
        ...

    @abstractmethod
    def update_status(
        self, event_id: str, *, status: WebhookStatus
    ) -> None:
        ...
