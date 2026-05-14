"""ChangeBillingCycleUseCase — monthly <-> yearly (FR-86)."""
from __future__ import annotations

from app.application.ports.billing_provider import BillingProvider
from app.application.ports.plans_repository import PlansRepository
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.domain.entities.subscription import Subscription
from app.domain.exceptions import NotFoundError, ValidationError


class ChangeBillingCycleUseCase:
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

    async def execute(
        self, *, user_id: str, new_billing_cycle: str
    ) -> Subscription:
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            raise NotFoundError("no tenés una suscripción activa")

        if new_billing_cycle not in ("monthly", "yearly"):
            raise ValidationError(
                "billing_cycle inválido. Debe ser 'monthly' o 'yearly'"
            )

        current_plan = self.plans.get_by_id(sub.plan_id)
        if current_plan is None:
            raise NotFoundError("plan actual no encontrado")

        if current_plan.billing_cycle == new_billing_cycle:
            raise ValidationError("ya estás en ese ciclo de facturación")

        target = self.plans.get_by_code(
            current_plan.code, billing_cycle=new_billing_cycle
        )
        if target is None:
            raise NotFoundError(
                f"no hay plan {current_plan.code} con ciclo {new_billing_cycle}"
            )

        if sub.lemon_squeezy_subscription_id and target.lemon_squeezy_variant_id:
            await self.provider.update_subscription(
                sub.lemon_squeezy_subscription_id,
                variant_id=target.lemon_squeezy_variant_id,
            )

        updated = self.subs.update_plan(sub.id, plan_id=target.id)
        if updated is None:
            raise NotFoundError("subscription update failed")

        self.log.execute(
            user_id=user_id,
            action="subscription.billing_cycle_changed",
            actor="user",
            actor_id=user_id,
            metadata={
                "subscription_id": sub.id,
                "from_plan": sub.plan_id,
                "to_plan": target.id,
                "new_cycle": new_billing_cycle,
            },
        )
        return updated
