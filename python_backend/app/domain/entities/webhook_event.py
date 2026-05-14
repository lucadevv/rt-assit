"""WebhookEvent domain entity (B5 — Billing).

Idempotency boundary: ``id`` is the provider's event id (Lemon Squeezy event_id).
INSERT OR IGNORE on receive — duplicates are dropped at the DB layer (NFR-8).
``signature`` is stored for audit, NOT re-validation."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Optional

WebhookStatus = Literal["received", "processing", "processed", "failed"]


@dataclass
class WebhookEvent:
    """A received webhook from a billing provider.

    The ``id`` field IS the provider's event id (no separate UUID) — this
    makes the table the deduplication boundary. Subsequent webhooks with
    the same id are dropped via INSERT OR IGNORE."""

    id: str
    provider: str
    event_type: str
    payload: dict[str, Any]
    signature: Optional[str]
    status: WebhookStatus
    error_message: Optional[str]
    retry_count: int
    received_at: datetime
    processed_at: Optional[datetime]
