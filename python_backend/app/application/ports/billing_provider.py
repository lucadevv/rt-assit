"""External billing provider port (B5 — Billing).

Multi-impl: LemonSqueezyProvider (production) + DevBillingProvider (mocked).
Selected via BILLING_MODE env var. Domain talks to this interface only —
the LS SDK is never imported outside infrastructure/billing/."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class BillingProvider(ABC):
    """Abstract billing/checkout provider."""

    @abstractmethod
    async def create_checkout_url(
        self,
        *,
        user_id: str,
        email: str,
        plan_id: str,
        variant_id: Optional[str],
        success_url: str,
        cancel_url: str,
        promo_code: Optional[str] = None,
    ) -> str:
        """Return a hosted checkout URL the client redirects to."""
        ...

    @abstractmethod
    async def cancel_subscription(
        self, lemon_squeezy_subscription_id: str
    ) -> None:
        """Mark the subscription as canceled at period_end at the provider."""
        ...

    @abstractmethod
    async def update_subscription(
        self,
        lemon_squeezy_subscription_id: str,
        *,
        variant_id: str,
    ) -> None:
        """Switch the plan variant (upgrade / cycle change). Provider handles proration."""
        ...

    @abstractmethod
    async def resume_subscription(
        self, lemon_squeezy_subscription_id: str
    ) -> None:
        """Un-cancel a subscription scheduled to cancel at period end."""
        ...

    @abstractmethod
    def verify_webhook_signature(
        self, payload: bytes, signature: str
    ) -> bool:
        """HMAC-SHA256 check (NFR-12). Constant-time comparison."""
        ...

    @abstractmethod
    def get_payment_method_portal_url(
        self, lemon_squeezy_customer_id: str
    ) -> str:
        """LS-hosted page where user manages cards (PCI-safe)."""
        ...
