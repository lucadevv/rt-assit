"""Integration domain entity (B4 — placeholder).

Represents a user's connection to a third-party provider
(Google Calendar, Slack, Notion). For now Susurra only supports
LISTING integrations (FR-51) — connect/disconnect flows live
under a future OAuth implementation. The DB schema reserves a
``credentials_encrypted`` column for that future flow, but the
domain entity does NOT expose it (security by design — credentials
never cross the application boundary).
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional


IntegrationProvider = Literal["google_calendar", "slack", "notion"]
IntegrationStatus = Literal["disconnected", "connected", "error"]


VALID_INTEGRATION_PROVIDERS: set[str] = {
    "google_calendar",
    "slack",
    "notion",
}
VALID_INTEGRATION_STATUSES: set[str] = {
    "disconnected",
    "connected",
    "error",
}


@dataclass
class Integration:
    """Third-party integration link for a user.

    ``credentials_encrypted`` is intentionally NOT a field — credentials
    must never be exposed via the domain. They live only inside the
    ``integrations`` table in infrastructure for future OAuth flows.
    """

    id: int
    user_id: str
    provider: IntegrationProvider
    status: IntegrationStatus = "disconnected"
    metadata: dict[str, Any] = field(default_factory=dict)
    connected_at: Optional[datetime] = None
    disconnected_at: Optional[datetime] = None
