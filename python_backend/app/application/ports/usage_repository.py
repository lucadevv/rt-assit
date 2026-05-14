"""Repository port for usage records (B5 — Billing).

Concurrency-safe via atomic SQL increments (NFR-24)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from app.domain.entities.usage_record import UsageRecord


class UsageRepository(ABC):
    """Usage counters per (user_id, period_start). Atomic ops only."""

    @abstractmethod
    def get_for_period(
        self, user_id: str, period_start: datetime
    ) -> Optional[UsageRecord]:
        ...

    @abstractmethod
    def get_or_create_for_period(
        self, user_id: str, period_start: datetime, period_end: datetime
    ) -> UsageRecord:
        """Returns the row for this period, creating it if absent.

        Uses INSERT OR IGNORE + SELECT to stay race-safe."""
        ...

    @abstractmethod
    def atomic_increment(
        self,
        *,
        user_id: str,
        period_start: datetime,
        period_end: datetime,
        field: str,
        delta: int,
    ) -> UsageRecord:
        """Atomic UPDATE counters SET <field> = <field> + <delta> WHERE...

        Auto-creates the row if it doesn't exist (UPSERT)."""
        ...

    @abstractmethod
    def list_history_for_user(
        self, user_id: str, *, months: int = 12
    ) -> list[UsageRecord]:
        ...

    @abstractmethod
    def reset_all_for_period(self, period_start: datetime) -> int:
        """Cron-only: insert empty records for every active user for a new
        period. Returns the number of users initialised."""
        ...
