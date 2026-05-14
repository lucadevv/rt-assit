"""Soft-delete a session."""
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.exceptions import NotFoundError


class DeleteSessionUseCase:
    def __init__(self, repo: SessionsRepository) -> None:
        self.repo = repo

    def execute(self, *, session_id: str, user_id: str) -> bool:
        deleted = self.repo.soft_delete(session_id, user_id)
        if not deleted:
            raise NotFoundError(f"sesión {session_id} no encontrada")
        return True
