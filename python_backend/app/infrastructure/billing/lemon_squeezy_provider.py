"""Lemon Squeezy billing provider — production adapter.

Implements BillingProvider using LS REST API + HMAC-SHA256 webhook
verification. Minimum surface: create_checkout_url, verify_webhook_signature,
cancel_subscription, update_subscription, resume_subscription, get_payment_method_portal_url.

Selected by BILLING_MODE=lemon_squeezy. Requires:
- LEMON_SQUEEZY_API_KEY
- LEMON_SQUEEZY_STORE_ID
- LEMON_SQUEEZY_WEBHOOK_SECRET
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any, Optional

import httpx

from app.application.ports.billing_provider import BillingProvider


logger = logging.getLogger(__name__)


LS_API_BASE = "https://api.lemonsqueezy.com/v1"


class LemonSqueezyProvider(BillingProvider):
    def __init__(
        self,
        *,
        api_key: str,
        store_id: str,
        webhook_secret: str,
    ) -> None:
        self.api_key = api_key
        self.store_id = store_id
        self.webhook_secret = webhook_secret

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {self.api_key}",
        }

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
        if not variant_id:
            raise RuntimeError(
                f"plan {plan_id} no tiene lemon_squeezy_variant_id configurado"
            )

        body: dict[str, Any] = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "checkout_data": {
                        "email": email,
                        "custom": {"user_id": user_id, "plan_id": plan_id},
                    },
                    "product_options": {
                        "redirect_url": success_url,
                    },
                    "checkout_options": {
                        "embed": False,
                        "media": False,
                        "logo": True,
                    },
                },
                "relationships": {
                    "store": {
                        "data": {"type": "stores", "id": self.store_id}
                    },
                    "variant": {
                        "data": {"type": "variants", "id": variant_id}
                    },
                },
            }
        }
        if promo_code:
            body["data"]["attributes"]["checkout_data"]["discount_code"] = promo_code

        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{LS_API_BASE}/checkouts", json=body, headers=self._headers()
            )
            r.raise_for_status()
            data = r.json()
            url = data.get("data", {}).get("attributes", {}).get("url")
            if not url:
                raise RuntimeError("LS no devolvió checkout url")
            return url

    async def cancel_subscription(
        self, lemon_squeezy_subscription_id: str
    ) -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.delete(
                f"{LS_API_BASE}/subscriptions/{lemon_squeezy_subscription_id}",
                headers=self._headers(),
            )
            r.raise_for_status()

    async def update_subscription(
        self,
        lemon_squeezy_subscription_id: str,
        *,
        variant_id: str,
    ) -> None:
        body = {
            "data": {
                "type": "subscriptions",
                "id": lemon_squeezy_subscription_id,
                "attributes": {"variant_id": int(variant_id)},
            }
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.patch(
                f"{LS_API_BASE}/subscriptions/{lemon_squeezy_subscription_id}",
                json=body,
                headers=self._headers(),
            )
            r.raise_for_status()

    async def resume_subscription(
        self, lemon_squeezy_subscription_id: str
    ) -> None:
        body = {
            "data": {
                "type": "subscriptions",
                "id": lemon_squeezy_subscription_id,
                "attributes": {"cancelled": False},
            }
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.patch(
                f"{LS_API_BASE}/subscriptions/{lemon_squeezy_subscription_id}",
                json=body,
                headers=self._headers(),
            )
            r.raise_for_status()

    def verify_webhook_signature(
        self, payload: bytes, signature: str
    ) -> bool:
        """HMAC-SHA256 with constant-time comparison (NFR-12)."""
        if not self.webhook_secret or not signature:
            return False
        expected = hmac.new(
            key=self.webhook_secret.encode("utf-8"),
            msg=payload,
            digestmod=hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def get_payment_method_portal_url(
        self, lemon_squeezy_customer_id: str
    ) -> str:
        # LS exposes the customer portal at the static path:
        # https://app.lemonsqueezy.com/my-orders or via the customer_portal URL
        # returned in the customer endpoint. For B5 we return the canonical
        # billing portal URL; live integration may swap to the API-issued one.
        return f"https://app.lemonsqueezy.com/my-orders?customer_id={lemon_squeezy_customer_id}"
