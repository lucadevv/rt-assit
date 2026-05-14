"""LogBillingAction — wrapper around BillingAuditLogRepository.append.

Used by every billing-affecting use case (NFR-19 — audit log obligatorio)."""
from __future__ import annotations

from typing import Any, Optional

from app.application.ports.billing_audit_log_repository import (
    BillingAuditLogRepository,
)
from app.domain.entities.billing_audit_log import ActorType, BillingAuditLog


class LogBillingActionUseCase:
    def __init__(self, audit_repo: BillingAuditLogRepository) -> None:
        self.audit_repo = audit_repo

    def execute(
        self,
        *,
        user_id: str,
        action: str,
        actor: ActorType,
        actor_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> BillingAuditLog:
        return self.audit_repo.append(
            user_id=user_id,
            action=action,
            actor=actor,
            actor_id=actor_id,
            metadata=metadata or {},
        )
