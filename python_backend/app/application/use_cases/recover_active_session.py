"""FR-22: page-refresh recovery — return latest non-ended session for the user."""
from typing import Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session import Session


class RecoverActiveSessionUseCase:
    def __init__(self, repo: SessionsRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str) -> Optional[Session]:
        return self.repo.get_active_for_user(user_id)
