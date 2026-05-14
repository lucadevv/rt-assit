"""ListPaymentMethodsUseCase + GetPaymentMethodPortalUrlUseCase."""
from __future__ import annotations

from app.application.ports.billing_provider import BillingProvider
from app.application.ports.payment_methods_repository import PaymentMethodsRepository
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.domain.entities.payment_method import PaymentMethod


class ListPaymentMethodsUseCase:
    def __init__(self, repo: PaymentMethodsRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str) -> list[PaymentMethod]:
        return self.repo.list_for_user(user_id)


class GetPaymentMethodPortalUrlUseCase:
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        billing_provider: BillingProvider,
    ) -> None:
        self.subs = subscriptions_repo
        self.provider = billing_provider

    def execute(self, *, user_id: str) -> str | None:
        """Returns the LS-hosted portal URL or None if no subscription/customer."""
        sub = self.subs.get_active_for_user(user_id)
        if sub is None or not sub.lemon_squeezy_customer_id:
            return None
        return self.provider.get_payment_method_portal_url(
            sub.lemon_squeezy_customer_id
        )
