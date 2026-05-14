"""DowngradeSubscriptionUseCase — schedule plan switch at period_end (FR-85)."""
from __future__ import annotations

from app.application.ports.plans_repository import PlansRepository
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.domain.entities.subscription import Subscription
from app.domain.exceptions import NotFoundError, ValidationError


class DowngradeSubscriptionUseCase:
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        plans_repo: PlansRepository,
        log_billing: LogBillingActionUseCase,
    ) -> None:
        self.subs = subscriptions_repo
        self.plans = plans_repo
        self.log = log_billing

    def execute(self, *, user_id: str, new_plan_id: str) -> Subscription:
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            raise NotFoundError("no tenés una suscripción activa")

        new_plan = self.plans.get_by_id(new_plan_id)
        if new_plan is None:
            raise NotFoundError(f"plan {new_plan_id} no encontrado")

        if new_plan.id == sub.plan_id:
            raise ValidationError("ese ya es tu plan actual")

        updated = self.subs.update_plan(sub.id, pending_plan_id=new_plan.id)
        if updated is None:
            raise NotFoundError("subscription update failed")
        # Mark cancel_at_period_end so the worker downgrades on rollover.
        updated = self.subs.update_status(
            sub.id, status=sub.status, cancel_at_period_end=True
        )

        self.log.execute(
            user_id=user_id,
            action="subscription.downgrade_scheduled",
            actor="user",
            actor_id=user_id,
            metadata={
                "subscription_id": sub.id,
                "from_plan": sub.plan_id,
                "to_plan": new_plan.id,
                "effective_at": sub.current_period_end.isoformat()
                if sub.current_period_end
                else None,
            },
        )
        return updated or sub
