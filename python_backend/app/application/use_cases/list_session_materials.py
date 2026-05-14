"""List materials attached to a session."""
from __future__ import annotations

from app.application.ports.session_materials_repository import (
    SessionMaterialsRepository,
)
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session_material import SessionMaterial
from app.domain.exceptions import NotFoundError


class ListSessionMaterialsUseCase:
    def __init__(
        self,
        materials_repo: SessionMaterialsRepository,
        sessions_repo: SessionsRepository,
    ) -> None:
        self.materials_repo = materials_repo
        self.sessions_repo = sessions_repo

    def execute(
        self, *, session_id: str, user_id: str
    ) -> list[SessionMaterial]:
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")
        return self.materials_repo.list_for_session(session_id)
