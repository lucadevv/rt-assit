"""GetCurrentUsageUseCase + GetUsageHistoryUseCase + ResetMonthlyUsageUseCase."""
from __future__ import annotations

import logging

from app.application.ports.usage_repository import UsageRepository
from app.application.services.billing_periods import current_month_period
from app.domain.entities.usage_record import UsageRecord


logger = logging.getLogger(__name__)


class GetCurrentUsageUseCase:
    def __init__(self, repo: UsageRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str) -> UsageRecord:
        period_start, period_end = current_month_period()
        return self.repo.get_or_create_for_period(user_id, period_start, period_end)


class GetUsageHistoryUseCase:
    def __init__(self, repo: UsageRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str, months: int = 12) -> list[UsageRecord]:
        return self.repo.list_history_for_user(user_id, months=months)


class ResetMonthlyUsageUseCase:
    """Cron — 1st of month 00:00 UTC. Initialises empty UsageRecord rows for
    every active user so the get_or_create code path is fast on first use."""

    def __init__(self, repo: UsageRepository) -> None:
        self.repo = repo

    def execute(self) -> int:
        period_start, _period_end = current_month_period()
        count = self.repo.reset_all_for_period(period_start)
        logger.info(
            f"[Usage] reset_monthly: initialised {count} usage rows for "
            f"period {period_start.isoformat()}"
        )
        return count
