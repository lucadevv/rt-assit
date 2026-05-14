"""Delete a session material scoped to its parent session."""
from __future__ import annotations

from app.application.ports.session_materials_repository import (
    SessionMaterialsRepository,
)
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.exceptions import NotFoundError


class DeleteSessionMaterialUseCase:
    def __init__(
        self,
        materials_repo: SessionMaterialsRepository,
        sessions_repo: SessionsRepository,
    ) -> None:
        self.materials_repo = materials_repo
        self.sessions_repo = sessions_repo

    def execute(
        self, *, session_id: str, material_id: int, user_id: str
    ) -> None:
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")
        if not self.materials_repo.delete(material_id, session_id=session_id):
            raise NotFoundError(f"material {material_id} no encontrado")
