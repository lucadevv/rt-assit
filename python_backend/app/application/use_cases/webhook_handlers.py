"""Lemon Squeezy webhook handlers (B5 — Billing).

8 specific handlers + 1 orchestrator. All idempotent (NFR-8) — the orchestrator
inserts the event row first; on duplicate, the entire chain is short-circuited.

All handlers receive the parsed payload dict. They look up the user_id from
LS custom data (we set it on checkout) or fall back to the customer email.

Spanish-first audit log + Spanish error messages preserved (NFR-9, NFR-21)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from app.application.ports.billing_provider import BillingProvider
from app.application.ports.invoices_repository import InvoicesRepository
from app.application.ports.plans_repository import PlansRepository
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.ports.users_repository import UsersRepository
from app.application.ports.webhook_events_repository import (
    WebhookEventsRepository,
)
from app.application.services.billing_periods import utcnow
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.application.use_cases.send_emails import (
    SendInvoicePaidEmailUseCase,
    SendPaymentFailedEmailUseCase,
)
from app.domain.exceptions import ValidationError


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers — payload parsing tolerant of missing keys (LS payload shapes vary)
# ---------------------------------------------------------------------------


def _get(payload: dict[str, Any], *path: str, default: Any = None) -> Any:
    cur: Any = payload
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key, default)
        if cur is None:
            return default
    return cur


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(
            tzinfo=None
        )
    except ValueError:
        return None


def _resolve_user_id(payload: dict[str, Any]) -> Optional[str]:
    """LS lets us pass arbitrary `custom_data` on checkout — we put user_id there."""
    custom = _get(payload, "meta", "custom_data") or _get(
        payload, "data", "attributes", "custom_data"
    )
    if isinstance(custom, dict):
        uid = custom.get("user_id")
        if isinstance(uid, str) and uid:
            return uid
    return None


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


class _BaseHandler:
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        users_repo: UsersRepository,
        plans_repo: PlansRepository,
        log_billing: LogBillingActionUseCase,
    ) -> None:
        self.subs = subscriptions_repo
        self.users = users_repo
        self.plans = plans_repo
        self.log = log_billing


class HandleSubscriptionCreatedWebhookUseCase(_BaseHandler):
    """LS event: ``subscription_created``."""

    def execute(self, *, payload: dict[str, Any]) -> None:
        user_id = _resolve_user_id(payload) or _get(
            payload, "data", "attributes", "user_email"
        )
        if not user_id:
            logger.warning("[Webhook] subscription_created: no user_id resolved")
            return

        ls_id = str(_get(payload, "data", "id") or "")
        ls_customer = str(
            _get(payload, "data", "attributes", "customer_id") or ""
        )
        variant_id = str(
            _get(payload, "data", "attributes", "variant_id") or ""
        )
        plan = (
            self.plans.get_by_lemon_squeezy_variant(variant_id)
            if variant_id
            else None
        )
        plan_id = plan.id if plan else "free"

        existing = self.subs.get_by_lemon_squeezy_id(ls_id) if ls_id else None
        if existing is not None:
            return

        period_start = _parse_dt(
            _get(payload, "data", "attributes", "renews_at")
        )
        sub_id = str(uuid.uuid4())
        self.subs.create(
            subscription_id=sub_id,
            user_id=user_id,
            plan_id=plan_id,
            status="active",
            lemon_squeezy_subscription_id=ls_id or None,
            lemon_squeezy_customer_id=ls_customer or None,
            current_period_start=utcnow(),
            current_period_end=period_start,
        )
        if plan and plan.code in ("pro", "premium", "byok"):
            try:
                self.users.update_tier(user_id=user_id, tier=plan.code)  # type: ignore[arg-type]
            except Exception as e:  # noqa: BLE001
                logger.warning(f"[Webhook] failed to bump tier: {e}")

        self.log.execute(
            user_id=user_id,
            action="subscription.created",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={"subscription_id": sub_id, "plan_id": plan_id},
        )


class HandleSubscriptionUpdatedWebhookUseCase(_BaseHandler):
    def execute(self, *, payload: dict[str, Any]) -> None:
        ls_id = str(_get(payload, "data", "id") or "")
        sub = self.subs.get_by_lemon_squeezy_id(ls_id) if ls_id else None
        if sub is None:
            return

        variant_id = str(
            _get(payload, "data", "attributes", "variant_id") or ""
        )
        plan = (
            self.plans.get_by_lemon_squeezy_variant(variant_id)
            if variant_id
            else None
        )
        if plan is not None and plan.id != sub.plan_id:
            self.subs.update_plan(sub.id, plan_id=plan.id)
            if plan.code in ("pro", "premium", "byok"):
                try:
                    self.users.update_tier(user_id=sub.user_id, tier=plan.code)  # type: ignore[arg-type]
                except Exception as e:  # noqa: BLE001
                    logger.warning(f"[Webhook] failed to bump tier: {e}")

        self.log.execute(
            user_id=sub.user_id,
            action="subscription.updated",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={"subscription_id": sub.id},
        )


class HandleSubscriptionCanceledWebhookUseCase(_BaseHandler):
    def execute(self, *, payload: dict[str, Any]) -> None:
        ls_id = str(_get(payload, "data", "id") or "")
        sub = self.subs.get_by_lemon_squeezy_id(ls_id) if ls_id else None
        if sub is None:
            return

        self.subs.update_status(
            sub.id,
            status="canceled",
            cancel_at_period_end=True,
            canceled_at=utcnow(),
        )
        self.log.execute(
            user_id=sub.user_id,
            action="subscription.canceled",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={"subscription_id": sub.id},
        )


class HandleSubscriptionResumedWebhookUseCase(_BaseHandler):
    def execute(self, *, payload: dict[str, Any]) -> None:
        ls_id = str(_get(payload, "data", "id") or "")
        sub = self.subs.get_by_lemon_squeezy_id(ls_id) if ls_id else None
        if sub is None:
            return

        self.subs.update_status(
            sub.id,
            status="active",
            cancel_at_period_end=False,
            canceled_at=None,
        )
        self.log.execute(
            user_id=sub.user_id,
            action="subscription.resumed",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={"subscription_id": sub.id},
        )


class HandleSubscriptionPaymentSuccessWebhookUseCase(_BaseHandler):
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        users_repo: UsersRepository,
        plans_repo: PlansRepository,
        invoices_repo: InvoicesRepository,
        log_billing: LogBillingActionUseCase,
        send_invoice_paid: SendInvoicePaidEmailUseCase,
    ) -> None:
        super().__init__(
            subscriptions_repo=subscriptions_repo,
            users_repo=users_repo,
            plans_repo=plans_repo,
            log_billing=log_billing,
        )
        self.invoices = invoices_repo
        self.send_invoice_paid = send_invoice_paid

    async def execute(self, *, payload: dict[str, Any]) -> None:
        ls_sub_id = str(
            _get(payload, "data", "attributes", "subscription_id") or ""
        )
        sub = (
            self.subs.get_by_lemon_squeezy_id(ls_sub_id) if ls_sub_id else None
        )
        if sub is None:
            return

        ls_invoice_id = str(_get(payload, "data", "id") or "")
        if ls_invoice_id and self.invoices.get_by_lemon_squeezy_id(
            ls_invoice_id
        ):
            return  # idempotent

        total_cents = int(
            _get(payload, "data", "attributes", "total", default=0) or 0
        )
        subtotal_cents = int(
            _get(payload, "data", "attributes", "subtotal", default=0) or 0
        )
        tax_cents = int(
            _get(payload, "data", "attributes", "tax", default=0) or 0
        )
        currency = str(
            _get(payload, "data", "attributes", "currency", default="USD")
            or "USD"
        )
        invoice_url = (
            _get(payload, "data", "attributes", "urls", "invoice_url") or None
        )
        invoice_id = str(uuid.uuid4())

        self.invoices.create(
            invoice_id=invoice_id,
            user_id=sub.user_id,
            subscription_id=sub.id,
            lemon_squeezy_invoice_id=ls_invoice_id or None,
            invoice_number=str(
                _get(payload, "data", "attributes", "invoice_number") or ""
            )
            or None,
            subtotal_cents=subtotal_cents,
            discount_cents=int(
                _get(payload, "data", "attributes", "discount_total", default=0)
                or 0
            ),
            tax_cents=tax_cents,
            tax_rate=float(
                _get(payload, "data", "attributes", "tax_rate", default=0) or 0
            ),
            total_cents=total_cents,
            currency=currency,
            status="paid",
            period_start=_parse_dt(
                _get(payload, "data", "attributes", "billing_period_start")
            ),
            period_end=_parse_dt(
                _get(payload, "data", "attributes", "billing_period_end")
            ),
            issued_at=utcnow(),
            paid_at=utcnow(),
            invoice_pdf_url=invoice_url,
        )

        self.subs.update_status(
            sub.id,
            status="active",
            payment_failed_at=None,
            grace_period_end=None,
        )

        self.log.execute(
            user_id=sub.user_id,
            action="invoice.paid",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={
                "invoice_id": invoice_id,
                "total_cents": total_cents,
                "currency": currency,
            },
        )

        # Best-effort welcome email.
        user = self.users.get_by_id(sub.user_id)
        if user:
            await self.send_invoice_paid.execute(
                to=user.email,
                amount_cents=total_cents,
                currency=currency,
                invoice_url=invoice_url,
            )


class HandleSubscriptionPaymentFailedWebhookUseCase(_BaseHandler):
    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        users_repo: UsersRepository,
        plans_repo: PlansRepository,
        log_billing: LogBillingActionUseCase,
        send_payment_failed: SendPaymentFailedEmailUseCase,
    ) -> None:
        super().__init__(
            subscriptions_repo=subscriptions_repo,
            users_repo=users_repo,
            plans_repo=plans_repo,
            log_billing=log_billing,
        )
        self.send_payment_failed = send_payment_failed

    async def execute(self, *, payload: dict[str, Any]) -> None:
        ls_sub_id = str(
            _get(payload, "data", "attributes", "subscription_id") or ""
        )
        sub = (
            self.subs.get_by_lemon_squeezy_id(ls_sub_id) if ls_sub_id else None
        )
        if sub is None:
            return

        now = utcnow()
        # 7-day grace window per NFR-15
        from datetime import timedelta

        grace_end = now + timedelta(days=7)
        self.subs.update_status(
            sub.id,
            status="past_due",
            payment_failed_at=now,
            grace_period_end=grace_end,
        )
        self.log.execute(
            user_id=sub.user_id,
            action="invoice.payment_failed",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={"subscription_id": sub.id},
        )

        user = self.users.get_by_id(sub.user_id)
        if user:
            import os

            base = os.getenv(
                "CHECKOUT_REDIRECT_BASE", "http://localhost:5173"
            ).rstrip("/")
            await self.send_payment_failed.execute(
                to=user.email, retry_url=f"{base}/billing"
            )


class HandleSubscriptionPaymentRecoveredWebhookUseCase(_BaseHandler):
    def execute(self, *, payload: dict[str, Any]) -> None:
        ls_sub_id = str(
            _get(payload, "data", "attributes", "subscription_id") or ""
        )
        sub = (
            self.subs.get_by_lemon_squeezy_id(ls_sub_id) if ls_sub_id else None
        )
        if sub is None:
            return

        self.subs.update_status(
            sub.id,
            status="active",
            payment_failed_at=None,
            grace_period_end=None,
        )
        self.log.execute(
            user_id=sub.user_id,
            action="invoice.payment_recovered",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={"subscription_id": sub.id},
        )


class HandleSubscriptionExpiredWebhookUseCase(_BaseHandler):
    def execute(self, *, payload: dict[str, Any]) -> None:
        ls_id = str(_get(payload, "data", "id") or "")
        sub = self.subs.get_by_lemon_squeezy_id(ls_id) if ls_id else None
        if sub is None:
            return

        self.subs.update_status(sub.id, status="expired")
        try:
            self.users.update_tier(user_id=sub.user_id, tier="free")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Webhook] failed to downgrade tier: {e}")
        self.log.execute(
            user_id=sub.user_id,
            action="subscription.expired",
            actor="webhook",
            actor_id="lemon_squeezy",
            metadata={"subscription_id": sub.id},
        )


# ---------------------------------------------------------------------------
# Orchestrator — the entry point for /api/billing/webhook
# ---------------------------------------------------------------------------


class ProcessWebhookEventUseCase:
    """Idempotent orchestrator: validate signature, dedupe, route to handler."""

    def __init__(
        self,
        *,
        billing_provider: BillingProvider,
        events_repo: WebhookEventsRepository,
        on_subscription_created: HandleSubscriptionCreatedWebhookUseCase,
        on_subscription_updated: HandleSubscriptionUpdatedWebhookUseCase,
        on_subscription_canceled: HandleSubscriptionCanceledWebhookUseCase,
        on_subscription_resumed: HandleSubscriptionResumedWebhookUseCase,
        on_payment_success: HandleSubscriptionPaymentSuccessWebhookUseCase,
        on_payment_failed: HandleSubscriptionPaymentFailedWebhookUseCase,
        on_payment_recovered: HandleSubscriptionPaymentRecoveredWebhookUseCase,
        on_subscription_expired: HandleSubscriptionExpiredWebhookUseCase,
    ) -> None:
        self.provider = billing_provider
        self.events = events_repo
        self.handlers = {
            "subscription_created": on_subscription_created,
            "subscription_updated": on_subscription_updated,
            "subscription_cancelled": on_subscription_canceled,
            "subscription_canceled": on_subscription_canceled,  # alias
            "subscription_resumed": on_subscription_resumed,
            "subscription_payment_success": on_payment_success,
            "subscription_payment_failed": on_payment_failed,
            "subscription_payment_recovered": on_payment_recovered,
            "subscription_expired": on_subscription_expired,
        }

    async def execute(
        self, *, body: bytes, signature: Optional[str]
    ) -> dict[str, Any]:
        # 1) Signature validation (NFR-12). Dev provider always returns True.
        if signature is None or not self.provider.verify_webhook_signature(
            body, signature
        ):
            raise ValidationError("firma de webhook inválida")

        # 2) Parse JSON
        import json

        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            raise ValidationError(f"payload inválido: {e}") from e

        # 3) Extract event id + name (LS structure: meta.event_name + meta.webhook_id?
        # Fall back to a hash if neither present)
        event_name = (
            _get(payload, "meta", "event_name")
            or _get(payload, "event_name")
            or "unknown"
        )
        event_id = (
            _get(payload, "meta", "webhook_id")
            or _get(payload, "data", "id")
            or _get(payload, "id")
        )
        if not event_id:
            # Build a deterministic id from the body so retries dedup.
            import hashlib

            event_id = hashlib.sha256(body).hexdigest()
        event_id = str(event_id)

        # 4) Idempotent insert.
        inserted = self.events.insert_or_skip(
            event_id=event_id,
            provider="lemon_squeezy",
            event_type=event_name,
            payload=payload,
            signature=signature,
        )
        if not inserted:
            logger.info(f"[Webhook] duplicate event {event_id}, skipping")
            return {"status": "duplicate", "event_id": event_id}

        # 5) Route.
        handler = self.handlers.get(event_name)
        if handler is None:
            logger.info(f"[Webhook] no handler for event_name={event_name}")
            self.events.update_status(event_id, status="processed")
            self.events.mark_processed(event_id, processed_at=utcnow())
            return {"status": "ignored", "event_id": event_id}

        try:
            self.events.update_status(event_id, status="processing")
            result = handler.execute(payload=payload)
            # Some handlers are async (payment_success / payment_failed
            # because they send emails) — await them.
            if hasattr(result, "__await__"):
                await result  # type: ignore[func-returns-value]
            self.events.mark_processed(event_id, processed_at=utcnow())
            return {"status": "processed", "event_id": event_id}
        except Exception as e:  # noqa: BLE001 — log + persist for retry/audit
            logger.exception(f"[Webhook] handler {event_name} failed: {e}")
            self.events.mark_failed(event_id, error_message=str(e))
            return {"status": "failed", "event_id": event_id}
