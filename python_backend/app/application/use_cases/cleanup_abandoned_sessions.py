"""CleanupAbandonedSessionsUseCase — orphan session reaper.

Background: the original /app/live flow created a session row at modal
submit AND (via a race in the in-memory draft store) sometimes again at
"Iniciar captura" click. The first row was orphaned forever with
``ended_at = NULL``. We migrated the frontend to URL-based session ids
in Wave 2B; this cron is the safety net for any future regression and
for legitimate cases where the user closes the tab between modal POST
and granting screen-share.

Algorithm (per run):
  1. Pull every session with ``ended_at IS NULL`` AND ``deleted_at IS NULL``
     whose ``started_at`` is older than ``now - timeout_minutes``.
  2. For each, count its transcripts. If zero, mark as ended via
     ``mark_abandoned`` (sets ``ended_at = started_at``, duration = 0).
  3. Skip sessions that have at least one transcript — those are legit
     long-running captures that haven't yet ended (the user might just
     be on a long call).
  4. Return a structured summary so the manual /api/admin/cron/run/...
     endpoint can echo useful counts to the dev.

Errors on individual sessions are logged and skipped so one bad row
doesn't poison the whole sweep. Synchronous (no async work — just two
repo calls per session). Wrapped in an ``async def execute`` so the
APScheduler/admin-route call sites match the other cron jobs' API.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.transcripts_repository import TranscriptsRepository


logger = logging.getLogger(__name__)


class CleanupAbandonedSessionsResult(TypedDict):
    """Structured result for the admin manual-trigger endpoint."""

    timeout_minutes: int
    candidates: int
    closed: int
    skipped_with_transcripts: int


class CleanupAbandonedSessionsUseCase:
    DEFAULT_TIMEOUT_MINUTES = 5

    def __init__(
        self,
        *,
        sessions_repo: SessionsRepository,
        transcripts_repo: TranscriptsRepository,
        timeout_minutes: int = DEFAULT_TIMEOUT_MINUTES,
    ) -> None:
        if timeout_minutes <= 0:
            raise ValueError("timeout_minutes must be > 0")
        self.sessions_repo = sessions_repo
        self.transcripts_repo = transcripts_repo
        self.timeout_minutes = timeout_minutes

    async def execute(
        self, *, timeout_minutes: int | None = None
    ) -> CleanupAbandonedSessionsResult:
        """Sweep and close abandoned sessions.

        Args:
            timeout_minutes: Optional override. Sessions older than
                ``now - timeout_minutes`` are candidates. When None the
                instance-level default is used.

        Returns:
            A ``CleanupAbandonedSessionsResult`` dict with counts.
        """
        effective = (
            timeout_minutes
            if timeout_minutes is not None
            else self.timeout_minutes
        )
        if effective <= 0:
            raise ValueError("timeout_minutes must be > 0")

        # sessions.started_at is stored in naive UTC ("YYYY-MM-DD HH:MM:SS")
        # via SQLite's ``datetime('now')``. Match that wire format so the
        # SQL comparison is apples-to-apples.
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
            minutes=effective
        )

        candidates = self.sessions_repo.list_stale_active(
            started_before=cutoff
        )

        closed = 0
        skipped = 0
        for sess in candidates:
            try:
                count = self.transcripts_repo.count_for_session(sess.id)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[CleanupAbandoned] count_for_session failed for "
                    f"session_id={sess.id}: {e}"
                )
                continue
            if count > 0:
                skipped += 1
                continue
            try:
                if self.sessions_repo.mark_abandoned(sess.id):
                    closed += 1
                    logger.info(
                        f"[CleanupAbandoned] closed session_id={sess.id} "
                        f"user_id={sess.user_id} scenario={sess.scenario} "
                        f"started_at={sess.started_at.isoformat()}"
                    )
            except Exception as e:  # noqa: BLE001
                logger.error(
                    f"[CleanupAbandoned] mark_abandoned failed for "
                    f"session_id={sess.id}: {e}"
                )

        result: CleanupAbandonedSessionsResult = {
            "timeout_minutes": effective,
            "candidates": len(candidates),
            "closed": closed,
            "skipped_with_transcripts": skipped,
        }
        logger.info(
            "[CleanupAbandoned] sweep done "
            f"candidates={result['candidates']} closed={result['closed']} "
            f"skipped={result['skipped_with_transcripts']}"
        )
        return result
