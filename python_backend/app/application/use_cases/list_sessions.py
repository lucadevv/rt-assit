"""List user's sessions, paginated, with optional filters."""
from typing import Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session import Session


class ListSessionsUseCase:
    def __init__(self, repo: SessionsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        user_id: str,
        scenario: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Session]:
        # Clamp pagination to sane ranges.
        limit = max(1, min(limit, 100))
        offset = max(0, offset)
        return self.repo.list(
            user_id=user_id,
            scenario=scenario,
            search=search,
            limit=limit,
            offset=offset,
        )
