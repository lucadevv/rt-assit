"""Notification domain entity (B8 — cross-cutting).

In-app + email notifications for usage warnings, trial expiring, payment
failed, session summary ready, share link viewed, system announcements.
Pure data, no framework dependencies."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional


NotificationType = Literal[
    "usage_warning",
    "trial_expiring",
    "payment_failed",
    "session_summary_ready",
    "share_link_viewed",
    "system_announcement",
]
NotificationChannel = Literal["email", "in_app", "both"]


VALID_NOTIFICATION_TYPES: set[str] = {
    "usage_warning",
    "trial_expiring",
    "payment_failed",
    "session_summary_ready",
    "share_link_viewed",
    "system_announcement",
}
VALID_NOTIFICATION_CHANNELS: set[str] = {"email", "in_app", "both"}


@dataclass
class Notification:
    """User-facing notification record.

    ``read_at=None`` => unread, ``sent_at=None`` => not yet dispatched (in
    case of channel='email' or 'both'). ``metadata`` stores type-specific
    payload (e.g. session_id for ``session_summary_ready``)."""

    id: int
    user_id: str
    type: NotificationType
    channel: NotificationChannel
    title: str
    body: str
    metadata: dict[str, Any] = field(default_factory=dict)
    read_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @property
    def is_read(self) -> bool:
        return self.read_at is not None
