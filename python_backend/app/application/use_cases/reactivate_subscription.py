"""ReactivateSubscriptionUseCase — un-cancel before period_end (FR-88)."""
from __future__ import annotations

from app.application.ports.billing_provider import BillingProvider
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.domain.entities.subscription import Subscription
from app.domain.exceptions import NotFoundError, ValidationError


class ReactivateSubscriptionUseCase:
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

        if not sub.cancel_at_period_end:
            raise ValidationError("la suscripción no está marcada para cancelarse")

        if sub.lemon_squeezy_subscription_id:
            await self.provider.resume_subscription(
                sub.lemon_squeezy_subscription_id
            )

        updated = self.subs.update_status(
            sub.id,
            status=sub.status,
            cancel_at_period_end=False,
            canceled_at=None,
        )
        if updated is None:
            raise NotFoundError("subscription reactivate failed")

        self.log.execute(
            user_id=user_id,
            action="subscription.reactivated",
            actor="user",
            actor_id=user_id,
            metadata={"subscription_id": sub.id},
        )
        return updated
