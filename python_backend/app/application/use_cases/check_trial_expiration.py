"""CheckTrialExpiration — daily cron transitions trialing -> expired (free)."""
from __future__ import annotations

import logging

from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.ports.users_repository import UsersRepository
from app.application.services.billing_periods import utcnow
from app.application.use_cases.log_billing_action import LogBillingActionUseCase


logger = logging.getLogger(__name__)


class CheckTrialExpirationUseCase:
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        users_repo: UsersRepository,
        log_billing: LogBillingActionUseCase,
    ) -> None:
        self.subscriptions = subscriptions_repo
        self.users = users_repo
        self.log_billing = log_billing

    def execute(self) -> int:
        """Returns the number of trials transitioned this run."""
        now = utcnow()
        expired = self.subscriptions.list_trials_expiring_before(now)
        count = 0
        for sub in expired:
            self.subscriptions.update_status(
                sub.id,
                status="expired",
                canceled_at=now,
            )
            try:
                self.users.update_tier(user_id=sub.user_id, tier="free")
            except Exception as e:  # noqa: BLE001 — best-effort tier sync
                logger.warning(
                    f"[Trial] failed to downgrade user {sub.user_id} to free: {e}"
                )
            self.log_billing.execute(
                user_id=sub.user_id,
                action="trial.expired",
                actor="system",
                actor_id=None,
                metadata={"subscription_id": sub.id},
            )
            count += 1
        if count:
            logger.info(f"[Trial] expired {count} trial subscriptions")
        return count
