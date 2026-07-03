"""Billing & subscriptions HTTP endpoints (B5).

Auth tiers:
- Public:        GET /api/plans
- Webhook:       POST /api/billing/webhook (signature-only)
- Authenticated: every /api/billing/* under JWT (or dev_default in dev mode)
- Dev-only:      /dev/billing/mock-checkout, /api/admin/cron/run/{job}

UpgradeRequiredError -> HTTP 402 (Payment Required) with structured detail
so the frontend can route to the upgrade modal."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)

from app.application.services.billing_periods import utcnow
from app.application.use_cases.cancel_subscription import (
    CancelSubscriptionUseCase,
)
from app.application.use_cases.change_billing_cycle import (
    ChangeBillingCycleUseCase,
)
from app.application.use_cases.create_checkout_session import (
    CreateCheckoutSessionUseCase,
)
from app.application.use_cases.downgrade_subscription import (
    DowngradeSubscriptionUseCase,
)
from app.application.use_cases.get_current_usage import (
    GetCurrentUsageUseCase,
    GetUsageHistoryUseCase,
)
from app.application.use_cases.get_subscription import GetSubscriptionUseCase
from app.application.use_cases.list_invoices import (
    GetInvoiceUseCase,
    ListInvoicesUseCase,
)
from app.application.use_cases.list_payment_methods import (
    GetPaymentMethodPortalUrlUseCase,
    ListPaymentMethodsUseCase,
)
from app.application.use_cases.list_plans import ListPlansUseCase
from app.application.use_cases.reactivate_subscription import (
    ReactivateSubscriptionUseCase,
)
from app.application.use_cases.start_trial import StartTrialUseCase
from app.application.use_cases.upgrade_subscription import (
    UpgradeSubscriptionUseCase,
)
from app.application.use_cases.validate_promo_code import (
    ValidatePromoCodeUseCase,
)
from app.application.use_cases.webhook_handlers import (
    ProcessWebhookEventUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import (
    NotFoundError,
    UpgradeRequiredError,
    ValidationError,
)
from app.presentation.api.schemas import (
    ChangeCycleRequest,
    CheckoutRequest,
    CheckoutResponse,
    DowngradeRequest,
    InvoiceResponse,
    PaymentMethodResponse,
    PlanResponse,
    PortalUrlResponse,
    PromoValidationResponse,
    SubscriptionResponse,
    UpgradeRequest,
    UsageHistoryResponse,
    UsageResponse,
    ValidatePromoRequest,
    WebhookAck,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    build_process_webhook_use_case,
    get_billing_provider,
    get_cancel_subscription_use_case,
    get_change_billing_cycle_use_case,
    get_create_checkout_session_use_case,
    get_downgrade_subscription_use_case,
    get_get_current_usage_use_case,
    get_get_invoice_use_case,
    get_get_subscription_use_case,
    get_get_usage_history_use_case,
    get_list_invoices_use_case,
    get_list_payment_methods_use_case,
    get_list_plans_use_case,
    get_payment_method_portal_url_use_case,
    get_reactivate_subscription_use_case,
    get_start_trial_use_case,
    get_upgrade_subscription_use_case,
    get_validate_promo_code_use_case,
    is_dev_billing,
)


logger = logging.getLogger(__name__)


router = APIRouter()


# ---------------------------------------------------------------------------
# Public — Plans
# ---------------------------------------------------------------------------


@router.get("/api/plans", response_model=list[PlanResponse])
async def list_plans(
    use_case: ListPlansUseCase = Depends(get_list_plans_use_case),
) -> list[PlanResponse]:
    plans = use_case.execute()
    return [PlanResponse.from_domain(p) for p in plans]


# ---------------------------------------------------------------------------
# Webhook (signature-only auth)
# ---------------------------------------------------------------------------


@router.post("/api/billing/webhook", response_model=WebhookAck)
async def webhook(
    request: Request,
    x_signature: Optional[str] = Header(default=None, alias="X-Signature"),
) -> WebhookAck:
    """Lemon Squeezy webhook handler. Auth: signature only (NFR-12)."""
    body = await request.body()
    use_case: ProcessWebhookEventUseCase = build_process_webhook_use_case()
    try:
        result = await use_case.execute(body=body, signature=x_signature)
    except ValidationError as e:
        # Don't leak signature validation details — return 401.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)
        ) from e
    return WebhookAck(
        status=result.get("status", "received"),
        event_id=result.get("event_id"),
    )


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/api/billing/subscription",
    response_model=Optional[SubscriptionResponse],
)
async def get_subscription(
    user: User = Depends(get_current_user),
    use_case: GetSubscriptionUseCase = Depends(get_get_subscription_use_case),
) -> Optional[SubscriptionResponse]:
    sub = use_case.execute(user_id=user.id)
    return SubscriptionResponse.from_domain(sub) if sub else None


@router.post("/api/billing/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    use_case: CreateCheckoutSessionUseCase = Depends(
        get_create_checkout_session_use_case
    ),
) -> CheckoutResponse:
    try:
        url = await use_case.execute(
            user=user,
            plan_id=body.plan_id,
            promo_code=body.promo_code,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return CheckoutResponse(checkout_url=url)


@router.post("/api/billing/upgrade", response_model=SubscriptionResponse)
async def upgrade(
    body: UpgradeRequest,
    user: User = Depends(get_current_user),
    use_case: UpgradeSubscriptionUseCase = Depends(
        get_upgrade_subscription_use_case
    ),
) -> SubscriptionResponse:
    try:
        sub = await use_case.execute(user_id=user.id, new_plan_id=body.plan_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SubscriptionResponse.from_domain(sub)


@router.post("/api/billing/downgrade", response_model=SubscriptionResponse)
async def downgrade(
    body: DowngradeRequest,
    user: User = Depends(get_current_user),
    use_case: DowngradeSubscriptionUseCase = Depends(
        get_downgrade_subscription_use_case
    ),
) -> SubscriptionResponse:
    try:
        sub = use_case.execute(user_id=user.id, new_plan_id=body.plan_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SubscriptionResponse.from_domain(sub)


@router.post("/api/billing/change-cycle", response_model=SubscriptionResponse)
async def change_cycle(
    body: ChangeCycleRequest,
    user: User = Depends(get_current_user),
    use_case: ChangeBillingCycleUseCase = Depends(
        get_change_billing_cycle_use_case
    ),
) -> SubscriptionResponse:
    try:
        sub = await use_case.execute(
            user_id=user.id, new_billing_cycle=body.to
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SubscriptionResponse.from_domain(sub)


@router.post("/api/billing/cancel", response_model=SubscriptionResponse)
async def cancel(
    user: User = Depends(get_current_user),
    use_case: CancelSubscriptionUseCase = Depends(
        get_cancel_subscription_use_case
    ),
) -> SubscriptionResponse:
    try:
        sub = await use_case.execute(user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return SubscriptionResponse.from_domain(sub)


@router.post("/api/billing/reactivate", response_model=SubscriptionResponse)
async def reactivate(
    user: User = Depends(get_current_user),
    use_case: ReactivateSubscriptionUseCase = Depends(
        get_reactivate_subscription_use_case
    ),
) -> SubscriptionResponse:
    try:
        sub = await use_case.execute(user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SubscriptionResponse.from_domain(sub)


@router.post("/api/billing/start-trial", response_model=Optional[SubscriptionResponse])
async def start_trial(
    user: User = Depends(get_current_user),
    use_case: StartTrialUseCase = Depends(get_start_trial_use_case),
) -> Optional[SubscriptionResponse]:
    sub = use_case.execute(user_id=user.id)
    return SubscriptionResponse.from_domain(sub) if sub else None


@router.get(
    "/api/billing/payment-methods",
    response_model=list[PaymentMethodResponse],
)
async def list_payment_methods(
    user: User = Depends(get_current_user),
    use_case: ListPaymentMethodsUseCase = Depends(
        get_list_payment_methods_use_case
    ),
) -> list[PaymentMethodResponse]:
    methods = use_case.execute(user_id=user.id)
    return [PaymentMethodResponse.from_domain(m) for m in methods]


@router.post(
    "/api/billing/payment-methods/portal", response_model=PortalUrlResponse
)
async def payment_methods_portal(
    user: User = Depends(get_current_user),
    use_case: GetPaymentMethodPortalUrlUseCase = Depends(
        get_payment_method_portal_url_use_case
    ),
) -> PortalUrlResponse:
    url = use_case.execute(user_id=user.id)
    return PortalUrlResponse(url=url)


@router.get("/api/billing/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    use_case: ListInvoicesUseCase = Depends(get_list_invoices_use_case),
) -> list[InvoiceResponse]:
    invoices = use_case.execute(user_id=user.id, limit=limit, offset=offset)
    return [InvoiceResponse.from_domain(i) for i in invoices]


@router.get(
    "/api/billing/invoices/{invoice_id}", response_model=InvoiceResponse
)
async def get_invoice(
    invoice_id: str,
    user: User = Depends(get_current_user),
    use_case: GetInvoiceUseCase = Depends(get_get_invoice_use_case),
) -> InvoiceResponse:
    invoice = use_case.execute(invoice_id=invoice_id, user_id=user.id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="factura no encontrada")
    return InvoiceResponse.from_domain(invoice)


@router.get("/api/billing/usage", response_model=UsageResponse)
async def get_current_usage(
    user: User = Depends(get_current_user),
    use_case: GetCurrentUsageUseCase = Depends(get_get_current_usage_use_case),
) -> UsageResponse:
    record = use_case.execute(user_id=user.id)
    return UsageResponse.from_domain(record)


@router.get("/api/billing/usage/history", response_model=UsageHistoryResponse)
async def get_usage_history(
    user: User = Depends(get_current_user),
    use_case: GetUsageHistoryUseCase = Depends(get_get_usage_history_use_case),
) -> UsageHistoryResponse:
    records = use_case.execute(user_id=user.id, months=12)
    return UsageHistoryResponse(
        items=[UsageResponse.from_domain(r) for r in records]
    )


@router.post(
    "/api/billing/promo/validate", response_model=PromoValidationResponse
)
async def validate_promo(
    body: ValidatePromoRequest,
    user: User = Depends(get_current_user),
    use_case: ValidatePromoCodeUseCase = Depends(
        get_validate_promo_code_use_case
    ),
) -> PromoValidationResponse:
    validation = use_case.execute(
        user_id=user.id, code=body.code, plan_id=body.plan_id
    )
    return PromoValidationResponse.from_validation(validation)


# ---------------------------------------------------------------------------
# Dev-only — mock checkout + admin cron triggers (BILLING_MODE=dev)
# ---------------------------------------------------------------------------


@router.post("/dev/billing/mock-checkout")
async def dev_mock_checkout(
    user_id: str = Query(...),
    plan: str = Query(...),
    promo: Optional[str] = Query(default=None),
):
    """Dev-only — simulates a successful checkout completion.

    Creates an active subscription, an invoice for it, audit log row, and
    sends a welcome email. Returns the subscription. Only registered when
    BILLING_MODE=dev (gated below)."""
    if not is_dev_billing():
        raise HTTPException(status_code=404, detail="not found")

    from app.presentation.deps import (
        _build_log_billing_action,
        _build_send_welcome_email,
        get_invoices_repository,
        get_plans_repository,
        get_subscriptions_repository,
        get_users_repository,
    )

    plans_repo = get_plans_repository()
    plan_obj = plans_repo.get_by_id(plan)
    if plan_obj is None:
        raise HTTPException(status_code=404, detail=f"plan {plan} no encontrado")

    subs_repo = get_subscriptions_repository()
    invoices_repo = get_invoices_repository()
    users_repo = get_users_repository()
    log_billing = _build_log_billing_action()

    now = utcnow()
    sub_id = str(uuid.uuid4())

    # If user already has an active subscription, update it; else create.
    existing = subs_repo.get_active_for_user(user_id)
    if existing is not None:
        subs_repo.update_plan(existing.id, plan_id=plan_obj.id)
        subs_repo.update_status(
            existing.id, status="active", cancel_at_period_end=False
        )
        sub = subs_repo.get(existing.id)
    else:
        sub = subs_repo.create(
            subscription_id=sub_id,
            user_id=user_id,
            plan_id=plan_obj.id,
            status="active",
            current_period_start=now,
            current_period_end=now,
            promo_code_applied=promo,
        )

    # Issue an invoice (paid).
    invoice_id = str(uuid.uuid4())
    invoices_repo.create(
        invoice_id=invoice_id,
        user_id=user_id,
        subscription_id=sub.id if sub else sub_id,
        lemon_squeezy_invoice_id=None,
        invoice_number=f"DEV-{int(now.timestamp())}",
        subtotal_cents=plan_obj.price_cents,
        discount_cents=0,
        tax_cents=0,
        tax_rate=0.0,
        total_cents=plan_obj.price_cents,
        currency=plan_obj.currency,
        status="paid",
        period_start=now,
        period_end=now,
        issued_at=now,
        paid_at=now,
        invoice_pdf_url=None,
    )

    # Bump user tier (if not free).
    if plan_obj.code in ("pro", "premium", "byok"):
        try:
            users_repo.update_tier(user_id=user_id, tier=plan_obj.code)  # type: ignore[arg-type]
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[DevMock] tier bump failed: {e}")

    log_billing.execute(
        user_id=user_id,
        action="checkout.mock_completed",
        actor="system",
        actor_id="dev_mock",
        metadata={
            "subscription_id": sub.id if sub else sub_id,
            "plan_id": plan_obj.id,
            "promo_code": promo,
        },
    )

    # Best-effort welcome email.
    user = users_repo.get_by_id(user_id)
    if user:
        try:
            await _build_send_welcome_email().execute(
                to=user.email, name=user.name
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[DevMock] welcome email failed: {e}")

    if sub is None:
        raise HTTPException(status_code=500, detail="mock checkout failed")
    return SubscriptionResponse.from_domain(sub)


@router.post("/api/admin/cron/run/{job_name}")
async def admin_run_cron(
    job_name: str,
    timeout_minutes: Optional[int] = Query(
        default=None,
        ge=1,
        le=1440,
        description=(
            "Only used by `cleanup_abandoned_sessions`. Overrides the "
            "default 5-minute threshold. Ignored by other jobs."
        ),
    ),
):
    """Manually trigger a cron job (dev only). Returns whatever the job returns."""
    if not is_dev_billing():
        raise HTTPException(status_code=404, detail="not found")

    from app.presentation.deps import (
        build_check_trial_expiration_use_case,
        build_cleanup_abandoned_sessions_use_case,
        build_cleanup_expired_recordings_use_case,
        build_refresh_tokens_repository,
        build_reset_monthly_usage_use_case,
    )

    if job_name == "check_trial_expiration":
        count = build_check_trial_expiration_use_case().execute()
        return {"job": job_name, "expired_count": count}
    if job_name == "reset_monthly_usage":
        count = build_reset_monthly_usage_use_case().execute()
        return {"job": job_name, "initialised_users": count}
    if job_name == "cleanup_expired_recordings":
        count = await build_cleanup_expired_recordings_use_case().execute()
        return {"job": job_name, "deleted_count": count}
    if job_name == "cleanup_abandoned_sessions":
        # `timeout_minutes` query-param override is forwarded into the
        # use-case factory so the same handler can sweep with a custom
        # threshold from the admin UI / curl without redeploying.
        uc = build_cleanup_abandoned_sessions_use_case(
            timeout_minutes=timeout_minutes
        )
        result = await uc.execute()
        return {"job": job_name, **result}
    if job_name == "prune_expired_refresh_tokens":
        deleted = build_refresh_tokens_repository().prune_expired()
        return {"job": job_name, "deleted_count": deleted}
    raise HTTPException(status_code=404, detail=f"job {job_name} no encontrado")


# ---------------------------------------------------------------------------
# Exception translation: UpgradeRequiredError -> HTTP 402
# ---------------------------------------------------------------------------


def upgrade_required_to_http(error: UpgradeRequiredError) -> HTTPException:
    """Helper used by other routers to translate UpgradeRequiredError to 402."""
    return HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "message": str(error),
            "limit": error.limit,
            "current_tier": error.current_tier,
            "required_tier": error.required_tier,
            "upgrade_url": "/billing",
        },
    )
