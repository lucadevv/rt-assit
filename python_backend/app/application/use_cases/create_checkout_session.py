"""CreateCheckoutSessionUseCase — invokes BillingProvider.create_checkout_url."""
from __future__ import annotations

import os
from typing import Optional

from app.application.ports.billing_provider import BillingProvider
from app.application.ports.plans_repository import PlansRepository
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundError


class CreateCheckoutSessionUseCase:
    def __init__(
        self,
        *,
        billing_provider: BillingProvider,
        plans_repo: PlansRepository,
        log_billing: LogBillingActionUseCase,
    ) -> None:
        self.provider = billing_provider
        self.plans = plans_repo
        self.log_billing = log_billing

    async def execute(
        self,
        *,
        user: User,
        plan_id: str,
        promo_code: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> str:
        plan = self.plans.get_by_id(plan_id)
        if plan is None:
            raise NotFoundError(f"plan {plan_id} no encontrado")

        if not plan.is_active:
            raise NotFoundError(f"plan {plan_id} no está activo")

        base = os.getenv("CHECKOUT_REDIRECT_BASE", "http://localhost:5173").rstrip("/")
        success_url = success_url or f"{base}/billing/success"
        cancel_url = cancel_url or f"{base}/billing"

        url = await self.provider.create_checkout_url(
            user_id=user.id,
            email=user.email,
            plan_id=plan.id,
            variant_id=plan.lemon_squeezy_variant_id,
            success_url=success_url,
            cancel_url=cancel_url,
            promo_code=promo_code,
        )

        self.log_billing.execute(
            user_id=user.id,
            action="checkout.created",
            actor="user",
            actor_id=user.id,
            metadata={"plan_id": plan.id, "promo_code": promo_code},
        )
        return url
