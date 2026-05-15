"""APScheduler async wrapper (B5 — Billing).

Manages cron jobs:
- check_trial_expiration   daily 09:00 UTC
- send_trial_expiring_email daily 10:00 UTC
- reset_monthly_usage       cron `0 0 1 * *` (1st of month 00:00 UTC)
- send_dunning_emails       daily 11:00 UTC

Dev mode (CRON_ENABLED=false): jobs registered but the scheduler is NOT
started — call them manually via /api/admin/cron/run/{job} for testing.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional


logger = logging.getLogger(__name__)


class SusurraScheduler:
    """Lightweight wrapper around APScheduler. Handles ImportError gracefully
    so dev-mode containers without the package still boot."""

    def __init__(self) -> None:
        self._scheduler: Optional[Any] = None
        self._jobs_enabled = (
            os.getenv("CRON_ENABLED", "false").lower() == "true"
        )
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore[import-untyped]

            self._scheduler = AsyncIOScheduler(timezone="UTC")
        except ImportError as e:  # pragma: no cover
            logger.warning(
                f"[Scheduler] apscheduler not installed; cron disabled: {e}"
            )
            self._scheduler = None

    @property
    def is_enabled(self) -> bool:
        return self._jobs_enabled and self._scheduler is not None

    def register_job(
        self, *, job_id: str, func, trigger: str = "cron", **trigger_kwargs
    ) -> None:
        """Register a job. ``trigger`` may be 'cron' or 'interval'.

        ``trigger_kwargs`` are passed straight through to APScheduler:
            register_job(job_id="x", func=fn, trigger="cron", hour=9, minute=0)
        """
        if self._scheduler is None:
            return
        try:
            self._scheduler.add_job(
                func, trigger, id=job_id, replace_existing=True, **trigger_kwargs
            )
            logger.info(
                f"[Scheduler] registered job_id={job_id} trigger={trigger} "
                f"kwargs={trigger_kwargs}"
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Scheduler] register_job {job_id} failed: {e}")

    def start(self) -> None:
        if self._scheduler is None:
            return
        if not self._jobs_enabled:
            logger.info(
                "[Scheduler] Disabled (CRON_ENABLED=false). Use "
                "/api/admin/cron/run/{job} for manual trigger in dev."
            )
            return
        try:
            self._scheduler.start()
            logger.info("[Scheduler] Started")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Scheduler] start failed: {e}")

    def shutdown(self) -> None:
        if self._scheduler is None or not self._jobs_enabled:
            return
        try:
            self._scheduler.shutdown(wait=False)
            logger.info("[Scheduler] shutdown")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Scheduler] shutdown failed: {e}")
