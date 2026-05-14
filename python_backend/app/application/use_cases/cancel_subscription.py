"""CancelSubscriptionUseCase — sets cancel_at_period_end=True (FR-87)."""
from __future__ import annotations

from app.application.ports.billing_provider import BillingProvider
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.services.billing_periods import utcnow
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.domain.entities.subscription import Subscription
from app.domain.exceptions import NotFoundError


class CancelSubscriptionUseCase:
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        billing_provider: BillingProvider,
        log_billing: LogBillingActionUseCase,
    ) -> None:
        self.subs = subscriptions_repo
        self.provider = billing_provider
        self.log = log_billing

    async def execute(self, *, user_id: str) -> Subscription:
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            raise NotFoundError("no tenés una suscripción activa")

        if sub.lemon_squeezy_subscription_id:
            await self.provider.cancel_subscription(
                sub.lemon_squeezy_subscription_id
            )

        now = utcnow()
        updated = self.subs.update_status(
            sub.id,
            status=sub.status,
            cancel_at_period_end=True,
            canceled_at=now,
        )
        if updated is None:
            raise NotFoundError("subscription cancel failed")

        self.log.execute(
            user_id=user_id,
            action="subscription.canceled",
            actor="user",
            actor_id=user_id,
            metadata={"subscription_id": sub.id},
        )
        return updated
