"""StartTrial — at signup, idempotent. Creates a trialing Subscription with
``status='trialing'`` and ``trial_end = now + 14 days`` on the pro_monthly plan.

Idempotency: if the user already has a non-expired subscription, returns it
unchanged (FR-81)."""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Optional

from app.application.ports.plans_repository import PlansRepository
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.services.billing_periods import utcnow
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.domain.entities.subscription import Subscription


TRIAL_DAYS = 14
TRIAL_PLAN_CODE = "pro"
TRIAL_PLAN_BILLING_CYCLE = "monthly"


class StartTrialUseCase:
    """Idempotent: creates a trialing Subscription for the user if absent."""

    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        plans_repo: PlansRepository,
        log_billing: LogBillingActionUseCase,
    ) -> None:
        self.subscriptions = subscriptions_repo
        self.plans = plans_repo
        self.log_billing = log_billing

    def execute(self, *, user_id: str) -> Optional[Subscription]:
        # If user already has any subscription row, do not create a new one.
        existing = self.subscriptions.get_active_for_user(user_id)
        if existing is not None:
            return existing

        plan = self.plans.get_by_code(
            TRIAL_PLAN_CODE, billing_cycle=TRIAL_PLAN_BILLING_CYCLE
        )
        if plan is None:
            # Catalog not yet seeded — should never happen post-init, but
            # we degrade gracefully (no exception bubbled to signup flow).
            return None

        now = utcnow()
        trial_end = now + timedelta(days=TRIAL_DAYS)
        sub_id = str(uuid.uuid4())
        sub = self.subscriptions.create(
            subscription_id=sub_id,
            user_id=user_id,
            plan_id=plan.id,
            status="trialing",
            trial_start=now,
            trial_end=trial_end,
            current_period_start=now,
            current_period_end=trial_end,
        )

        self.log_billing.execute(
            user_id=user_id,
            action="trial.started",
            actor="system",
            actor_id=None,
            metadata={
                "subscription_id": sub_id,
                "plan_id": plan.id,
                "trial_days": TRIAL_DAYS,
            },
        )
        return sub
