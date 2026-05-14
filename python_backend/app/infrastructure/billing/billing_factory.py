"""Factory selecting the BillingProvider implementation by env var.

BILLING_MODE=dev (default)         -> DevBillingProvider (mocked)
BILLING_MODE=lemon_squeezy         -> LemonSqueezyProvider (real API)
"""
from __future__ import annotations

import logging
import os

from app.application.ports.billing_provider import BillingProvider
from app.infrastructure.billing.dev_billing_provider import DevBillingProvider
from app.infrastructure.billing.lemon_squeezy_provider import (
    LemonSqueezyProvider,
)


logger = logging.getLogger(__name__)


def create_billing_provider() -> BillingProvider:
    mode = os.getenv("BILLING_MODE", "dev").lower()
    if mode == "lemon_squeezy":
        api_key = os.getenv("LEMON_SQUEEZY_API_KEY", "")
        store_id = os.getenv("LEMON_SQUEEZY_STORE_ID", "")
        webhook_secret = os.getenv("LEMON_SQUEEZY_WEBHOOK_SECRET", "")
        if not api_key or not store_id:
            logger.warning(
                "[Billing] BILLING_MODE=lemon_squeezy but credentials missing — "
                "falling back to DevBillingProvider"
            )
            return DevBillingProvider()
        logger.info("[Billing] Using LemonSqueezyProvider")
        return LemonSqueezyProvider(
            api_key=api_key,
            store_id=store_id,
            webhook_secret=webhook_secret,
        )
    logger.info("[Billing] Using DevBillingProvider (BILLING_MODE=dev)")
    return DevBillingProvider()


def is_dev_billing_mode() -> bool:
    """True iff BILLING_MODE selects the dev provider (default)."""
    return os.getenv("BILLING_MODE", "dev").lower() != "lemon_squeezy"
