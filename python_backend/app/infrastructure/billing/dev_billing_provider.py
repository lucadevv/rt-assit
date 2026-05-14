"""Dev billing provider — mocks Lemon Squeezy for local development.

BILLING_MODE=dev selects this. Returns local mock-checkout URLs that point
back to the dev-only POST /dev/billing/mock-checkout endpoint, which simulates
a successful purchase. Webhook signature verification always returns True so
manual curl-driven webhook tests don't need real HMAC."""
from __future__ import annotations

import logging
import os
from typing import Optional

from app.application.ports.billing_provider import BillingProvider


logger = logging.getLogger(__name__)


class DevBillingProvider(BillingProvider):
    """No-op + mock URLs. Never reaches the network."""

    def __init__(self) -> None:
        # Where the dev mock-checkout lives. The router registers it on
        # /dev/billing/mock-checkout when BILLING_MODE=dev.
        self.base_url = os.getenv(
            "DEV_BILLING_BASE", "http://localhost:8767"
        ).rstrip("/")

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
        url = (
            f"{self.base_url}/dev/billing/mock-checkout"
            f"?user_id={user_id}&plan={plan_id}"
        )
        if promo_code:
            url += f"&promo={promo_code}"
        logger.info(
            f"[DevBilling] create_checkout_url user={user_id} plan={plan_id} -> {url}"
        )
        return url

    async def cancel_subscription(
        self, lemon_squeezy_subscription_id: str
    ) -> None:
        logger.info(
            f"[DevBilling] cancel_subscription ls_sub={lemon_squeezy_subscription_id}"
        )

    async def update_subscription(
        self,
        lemon_squeezy_subscription_id: str,
        *,
        variant_id: str,
    ) -> None:
        logger.info(
            f"[DevBilling] update_subscription ls_sub={lemon_squeezy_subscription_id} "
            f"variant={variant_id}"
        )

    async def resume_subscription(
        self, lemon_squeezy_subscription_id: str
    ) -> None:
        logger.info(
            f"[DevBilling] resume_subscription ls_sub={lemon_squeezy_subscription_id}"
        )

    def verify_webhook_signature(
        self, payload: bytes, signature: str
    ) -> bool:
        # Dev: accept everything (signature can be anything, even empty string).
        return True

    def get_payment_method_portal_url(
        self, lemon_squeezy_customer_id: str
    ) -> str:
        return (
            f"{self.base_url}/dev/billing/mock-portal"
            f"?customer_id={lemon_squeezy_customer_id}"
        )
