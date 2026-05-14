"""End an active session: set ended_at + duration_seconds.

Idempotency contract:
  - Session not found       -> NotFoundError (404)
  - Session soft-deleted    -> GoneError    (410)
  - Session already ended   -> return as-is, was_already_ended=True (200, no DB write)
  - Session active          -> set ended_at + duration, was_already_ended=False
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session import Session
from app.domain.exceptions import GoneError, NotFoundError


logger = logging.getLogger(__name__)


@dataclass
class EndSessionResult:
    """Result of EndSessionUseCase.

    ``was_already_ended`` lets the presentation layer skip side effects
    (background summary, usage counters) on idempotent retries — they were
    already triggered on the original close."""

    session: Session
    was_already_ended: bool


class EndSessionUseCase:
    def __init__(self, repo: SessionsRepository) -> None:
        self.repo = repo

    def execute(self, *, session_id: str, user_id: str) -> EndSessionResult:
        existing = self.repo.get(session_id, user_id)
        if existing is None:
            # Distinguish truly-missing (404) from soft-deleted (410 Gone).
            # repo.get() filters out deleted_at; a second lookup that
            # includes deleted rows tells us which case we're in.
            deleted = self.repo.get_including_deleted(session_id, user_id)
            if deleted is not None and deleted.deleted_at is not None:
                raise GoneError(
                    f"sesión {session_id} fue eliminada"
                )
            raise NotFoundError(f"sesión {session_id} no encontrada")

        # Idempotent: if the session already has ended_at, return it as-is.
        # No DB write, no error — the frontend can safely retry this call.
        if existing.ended_at is not None:
            logger.debug(
                "[EndSession] session=%s already ended at %s; returning as-is",
                session_id,
                existing.ended_at,
            )
            return EndSessionResult(session=existing, was_already_ended=True)

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        # started_at may be naive (parsed from SQLite) — assume UTC for diff.
        started = existing.started_at
        duration = max(0, int((now - started).total_seconds()))

        updated = self.repo.update(
            session_id=session_id,
            user_id=user_id,
            ended_at=now,
            duration_seconds=duration,
        )
        return EndSessionResult(session=updated, was_already_ended=False)
