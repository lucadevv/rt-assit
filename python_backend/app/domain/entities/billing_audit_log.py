"""BillingAuditLog domain entity (B5 — Billing).

Compliance/legal artifact (NFR-19). EVERY billing-affecting action MUST
write a row here: subscription created/changed/canceled, payment success/fail,
refund, plan upgrade, promo applied, etc. Retention 7 years (FR-111)."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

ActorType = Literal["user", "system", "admin", "webhook"]


@dataclass
class BillingAuditLog:
    """Append-only billing audit row."""

    id: int
    user_id: str
    action: str
    actor: ActorType
    actor_id: Optional[str]
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
