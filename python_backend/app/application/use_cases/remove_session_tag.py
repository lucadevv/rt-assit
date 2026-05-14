"""Untag a session."""
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.session_tags_repository import SessionTagsRepository
from app.domain.exceptions import NotFoundError


class RemoveSessionTagUseCase:
    def __init__(
        self,
        sessions_repo: SessionsRepository,
        tags_repo: SessionTagsRepository,
    ) -> None:
        self.sessions = sessions_repo
        self.tags = tags_repo

    def execute(self, *, session_id: str, user_id: str, tag: str) -> bool:
        if self.sessions.get(session_id, user_id) is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        return self.tags.remove_tag(session_id=session_id, tag=tag.strip().lower())
