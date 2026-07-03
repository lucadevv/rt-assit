"""FastAPI app entry point.

Kept at `app/main.py` (NOT moved under presentation/) so the existing uvicorn
entrypoint `uvicorn app.main:app` keeps working without docker-compose changes.

This module is the composition root for the application:
- loads .env
- bootstraps the SQLite schema during lifespan startup
- registers + (optionally) starts the cron scheduler
- wires presentation routers (HTTP + WebSocket)
"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv


# Load env vars before importing app modules that read them at import time.
load_dotenv()

# Match the previous logging setup (DEBUG to stdout).
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


from app.infrastructure.persistence.sqlite.db import init_db
from app.presentation.api import (
    admin_router,
    api_keys_router,
    auth_router,
    billing_router,
    documents_router,
    health_router,
    me_router,
    meetings_router,
    notifications_router,
    oauth_router,
    personas_router,
    pre_meeting_notes_router,
    recordings_router,
    scenarios_router,
    session_materials_router,
    sessions_router,
    share_router,
    waitlist_router,
)
from app.presentation.deps import (
    build_check_trial_expiration_use_case,
    build_cleanup_abandoned_sessions_use_case,
    build_cleanup_expired_recordings_use_case,
    build_refresh_tokens_repository,
    build_reset_monthly_usage_use_case,
    build_send_dunning_email_use_case,
    build_send_trial_expiring_email_use_case,
    get_rate_limiter,
    get_scheduler,
)
from app.presentation.middleware import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.presentation.websocket import router as ws_router


logger = logging.getLogger(__name__)


def _register_cron_jobs() -> None:
    """Register the B5 cron jobs with the SusurraScheduler.

    In dev (CRON_ENABLED=false) the jobs are registered but the scheduler is
    NOT started — they can still be invoked manually via
    /api/admin/cron/run/{job}. In prod, scheduler.start() activates them."""
    scheduler = get_scheduler()

    def _check_trials():
        try:
            build_check_trial_expiration_use_case().execute()
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Cron] check_trial_expiration failed: {e}")

    async def _send_trial_expiring_emails():
        # Daily — finds trials expiring within next 24h and sends notice.
        try:
            from datetime import timedelta

            from app.application.services.billing_periods import utcnow
            from app.presentation.deps import (
                get_subscriptions_repository,
                get_users_repository,
            )

            subs = get_subscriptions_repository()
            users = get_users_repository()
            cutoff = utcnow() + timedelta(hours=24)
            expiring = subs.list_trials_expiring_before(cutoff)
            sender = build_send_trial_expiring_email_use_case()
            for sub in expiring:
                u = users.get_by_id(sub.user_id)
                if not u:
                    continue
                hours_left = 24
                if sub.trial_end:
                    diff = sub.trial_end - utcnow()
                    hours_left = max(0, int(diff.total_seconds() // 3600))
                await sender.execute(
                    to=u.email, name=u.name, hours_left=hours_left
                )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Cron] send_trial_expiring_emails failed: {e}")

    def _reset_monthly_usage():
        try:
            build_reset_monthly_usage_use_case().execute()
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Cron] reset_monthly_usage failed: {e}")

    async def _send_dunning_emails():
        try:
            from app.presentation.deps import (
                get_subscriptions_repository,
                get_users_repository,
            )

            subs = get_subscriptions_repository()
            users = get_users_repository()
            sender = build_send_dunning_email_use_case()
            past_due = subs.list_past_due()
            import os

            base = os.getenv(
                "CHECKOUT_REDIRECT_BASE", "http://localhost:5173"
            ).rstrip("/")
            for sub in past_due:
                u = users.get_by_id(sub.user_id)
                if not u:
                    continue
                count = subs.increment_dunning(sub.id)
                await sender.execute(
                    to=u.email, attempt=count, retry_url=f"{base}/billing"
                )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Cron] send_dunning_emails failed: {e}")

    scheduler.register_job(
        job_id="check_trial_expiration",
        func=_check_trials,
        trigger="cron",
        hour=9,
        minute=0,
    )
    scheduler.register_job(
        job_id="send_trial_expiring_emails",
        func=_send_trial_expiring_emails,
        trigger="cron",
        hour=10,
        minute=0,
    )
    scheduler.register_job(
        job_id="reset_monthly_usage",
        func=_reset_monthly_usage,
        trigger="cron",
        day=1,
        hour=0,
        minute=0,
    )
    scheduler.register_job(
        job_id="send_dunning_emails",
        func=_send_dunning_emails,
        trigger="cron",
        hour=11,
        minute=0,
    )

    # B6 — recordings cleanup (daily 03:00 UTC).
    async def _cleanup_expired_recordings():
        try:
            await build_cleanup_expired_recordings_use_case().execute()
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[Cron] cleanup_expired_recordings failed: {e}"
            )

    scheduler.register_job(
        job_id="cleanup_expired_recordings",
        func=_cleanup_expired_recordings,
        trigger="cron",
        hour=3,
        minute=0,
    )

    # Wave 2B safety-net — close sessions with zero transcripts whose
    # `started_at` is older than 5 minutes (orphans from the legacy
    # in-memory draft-store race). Runs every 5 minutes so a freshly
    # abandoned row is reaped within ~10 min worst case. Interval
    # trigger (not cron) matches the cadence semantics.
    async def _cleanup_abandoned_sessions():
        try:
            await build_cleanup_abandoned_sessions_use_case().execute()
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[Cron] cleanup_abandoned_sessions failed: {e}"
            )

    scheduler.register_job(
        job_id="cleanup_abandoned_sessions",
        func=_cleanup_abandoned_sessions,
        trigger="interval",
        minutes=5,
    )

    # Auth Sprint A — prune refresh_tokens rows whose expires_at is in the
    # past. Daily at 02:15 UTC (offset from the 02:00/03:00 jobs to avoid
    # a simultaneous I/O burst). Idempotent + cheap (single DELETE WHERE
    # over an indexed column) so re-runs on missed schedules are fine.
    def _prune_expired_refresh_tokens():
        try:
            deleted = build_refresh_tokens_repository().prune_expired()
            logger.info(
                f"[Cron] prune_expired_refresh_tokens deleted={deleted}"
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[Cron] prune_expired_refresh_tokens failed: {e}"
            )

    scheduler.register_job(
        job_id="prune_expired_refresh_tokens",
        func=_prune_expired_refresh_tokens,
        trigger="cron",
        hour=2,
        minute=15,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _register_cron_jobs()
    scheduler = get_scheduler()
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown()


def create_app() -> FastAPI:
    app = FastAPI(
        title="RTAssist API",
        description="AI Multi-Scenario Conversational Copilot",
        version="0.2.0",
        lifespan=lifespan,
    )

    # B8 — Cross-cutting middlewares.
    # Starlette runs middlewares in reverse-add order, so the LAST
    # ``add_middleware`` call wraps the response first (outermost).
    # We want security headers to run on every response (including
    # 429 from the rate limiter) so they're added LAST.
    import os

    rate_limit_per_min = int(os.getenv("RATE_LIMIT_PER_MIN", "100"))
    rate_limit_public_per_min = int(
        os.getenv("RATE_LIMIT_PUBLIC_PER_MIN", "30")
    )
    app.add_middleware(
        RateLimitMiddleware,
        rate_limiter=get_rate_limiter(),
        default_per_min=rate_limit_per_min,
        public_per_min=rate_limit_public_per_min,
    )
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS — origins driven by env. Defaults are the dev frontends (Vite
    # 5173, Next 3000). In prod the deployer sets ALLOWED_ORIGINS to a
    # comma-separated list of trusted origins. We HARD-FAIL on the
    # ('*' + credentials) combo because it's a known CSRF / credential-
    # exfil vector and silently downgrading at runtime hides the misconfig
    # from operators (the backend would boot "fine" but cookies wouldn't
    # work, leading to a confusing debug session in prod).
    raw_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    )
    cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    cors_allow_credentials = True
    if "*" in cors_origins and cors_allow_credentials:
        raise RuntimeError(
            "CORS misconfiguration: ALLOWED_ORIGINS='*' is incompatible with "
            "credential-based auth (cookies/Bearer). Set ALLOWED_ORIGINS to "
            "an explicit list of origins OR disable credentials."
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": "RTAssist API", "ws": "/ws"}

    app.include_router(health_router.router, tags=["health"])
    app.include_router(auth_router.router, tags=["auth"])
    app.include_router(me_router.router, tags=["users"])
    app.include_router(documents_router.router, tags=["documents"])
    app.include_router(scenarios_router.router, tags=["scenarios"])
    app.include_router(sessions_router.router, tags=["sessions"])
    app.include_router(billing_router.router, tags=["billing"])
    app.include_router(recordings_router.router, tags=["recordings"])
    app.include_router(share_router.router, tags=["share"])
    app.include_router(notifications_router.router, tags=["notifications"])
    app.include_router(api_keys_router.router, tags=["api-keys"])
    app.include_router(admin_router.router, tags=["admin"])
    app.include_router(oauth_router.router, tags=["oauth"])
    app.include_router(meetings_router.router, tags=["meetings"])
    app.include_router(personas_router.router, tags=["personas"])
    app.include_router(
        session_materials_router.router, tags=["session-materials"]
    )
    app.include_router(
        pre_meeting_notes_router.router, tags=["pre-meeting-notes"]
    )
    app.include_router(waitlist_router.router, tags=["waitlist"])
    app.include_router(ws_router.router, tags=["websocket"])

    return app


app = create_app()
