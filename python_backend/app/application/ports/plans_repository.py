"""Repository port for plan catalog (B5 — Billing)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.plan import Plan


class PlansRepository(ABC):
    """Read-only catalog of plans (seeded via init_db)."""

    @abstractmethod
    def list_active(self) -> list[Plan]:
        """All non-legacy active plans, ordered by sort_order."""
        ...

    @abstractmethod
    def list_all(self) -> list[Plan]:
        """All plans including legacy (used internally for grandfathering)."""
        ...

    @abstractmethod
    def get_by_id(self, plan_id: str) -> Optional[Plan]:
        ...

    @abstractmethod
    def get_by_code(
        self, code: str, billing_cycle: str = "monthly"
    ) -> Optional[Plan]:
        """Lookup the active plan by tier code + billing cycle."""
        ...

    @abstractmethod
    def get_by_lemon_squeezy_variant(self, variant_id: str) -> Optional[Plan]:
        """Reverse lookup used by webhook handlers."""
        ...
