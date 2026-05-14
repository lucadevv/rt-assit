"""Patch a session's editable fields (title, action_items, summary, metadata)."""
from typing import Any, Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session import Session
from app.domain.exceptions import NotFoundError


class UpdateSessionUseCase:
    def __init__(self, repo: SessionsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        title: Optional[str] = None,
        summary: Optional[str] = None,
        action_items: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Session:
        existing = self.repo.get(session_id, user_id)
        if existing is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        return self.repo.update(
            session_id=session_id,
            user_id=user_id,
            title=title,
            summary=summary,
            action_items=action_items,
            metadata=metadata,
        )
