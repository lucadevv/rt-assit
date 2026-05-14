"""UpgradeSubscriptionUseCase — switch plan immediately (proration handled by LS)."""
from __future__ import annotations

from app.application.ports.billing_provider import BillingProvider
from app.application.ports.plans_repository import PlansRepository
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.domain.entities.subscription import Subscription
from app.domain.exceptions import NotFoundError, ValidationError


class UpgradeSubscriptionUseCase:
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        plans_repo: PlansRepository,
        billing_provider: BillingProvider,
        log_billing: LogBillingActionUseCase,
    ) -> None:
        self.subs = subscriptions_repo
        self.plans = plans_repo
        self.provider = billing_provider
        self.log = log_billing

    async def execute(self, *, user_id: str, new_plan_id: str) -> Subscription:
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            raise NotFoundError("no tenés una suscripción activa")

        new_plan = self.plans.get_by_id(new_plan_id)
        if new_plan is None:
            raise NotFoundError(f"plan {new_plan_id} no encontrado")

        if new_plan.id == sub.plan_id:
            raise ValidationError("ese ya es tu plan actual")

        # Provider call — only when there's a real LS subscription id.
        if sub.lemon_squeezy_subscription_id and new_plan.lemon_squeezy_variant_id:
            await self.provider.update_subscription(
                sub.lemon_squeezy_subscription_id,
                variant_id=new_plan.lemon_squeezy_variant_id,
            )

        updated = self.subs.update_plan(sub.id, plan_id=new_plan.id)
        if updated is None:
            raise NotFoundError("subscription update failed")

        self.log.execute(
            user_id=user_id,
            action="subscription.upgraded",
            actor="user",
            actor_id=user_id,
            metadata={
                "subscription_id": sub.id,
                "from_plan": sub.plan_id,
                "to_plan": new_plan.id,
            },
        )
        return updated
