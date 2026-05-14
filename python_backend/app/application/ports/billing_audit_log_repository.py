"""Repository port for billing audit log (B5 — Billing).

Append-only. Retention 7 years (FR-111)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.domain.entities.billing_audit_log import ActorType, BillingAuditLog


class BillingAuditLogRepository(ABC):
    @abstractmethod
    def append(
        self,
        *,
        user_id: str,
        action: str,
        actor: ActorType,
        actor_id: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> BillingAuditLog:
        ...

    @abstractmethod
    def list_for_user(
        self, user_id: str, *, limit: int = 100
    ) -> list[BillingAuditLog]:
        ...
