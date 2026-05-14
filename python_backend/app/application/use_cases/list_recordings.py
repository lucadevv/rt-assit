"""ListRecordingsUseCase (B6).

Lists a user's recordings joined with their session metadata (title, scenario,
duration). Pagination via limit/offset. Multi-tenant via the underlying repo
JOIN on ``sessions.user_id``."""
from __future__ import annotations

from app.application.ports.recordings_repository import RecordingsRepository
from app.domain.entities.recording import Recording
from app.domain.entities.session import Session


class ListRecordingsUseCase:
    def __init__(self, recordings_repo: RecordingsRepository) -> None:
        self.recordings_repo = recordings_repo

    def execute(
        self,
        *,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[tuple[Recording, Session]]:
        # Defensive bounds (router validation already clamps, but keep
        # use-case self-contained for testing).
        limit = max(1, min(int(limit), 100))
        offset = max(0, int(offset))
        return self.recordings_repo.list_for_user(
            user_id, limit=limit, offset=offset
        )
