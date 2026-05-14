"""Create a session-scoped ad-hoc material (brief/agenda/link/note/...).

Session ownership is validated via SessionsRepository BEFORE writing —
this is the only authz boundary because session_materials has no
``user_id`` column of its own (the access-control invariant is "owns the
parent session = can mutate its materials").
"""
from __future__ import annotations

from typing import Optional, get_args

from app.application.ports.session_materials_repository import (
    SessionMaterialsRepository,
)
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session_material import (
    SessionMaterial,
    SessionMaterialType,
)
from app.domain.exceptions import NotFoundError, ValidationError


VALID_MATERIAL_TYPES = set(get_args(SessionMaterialType))


class CreateSessionMaterialUseCase:
    def __init__(
        self,
        materials_repo: SessionMaterialsRepository,
        sessions_repo: SessionsRepository,
    ) -> None:
        self.materials_repo = materials_repo
        self.sessions_repo = sessions_repo

    def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        material_type: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        source_url: Optional[str] = None,
    ) -> SessionMaterial:
        if material_type not in VALID_MATERIAL_TYPES:
            raise ValidationError(
                f"material_type inválido. Debe ser uno de: "
                f"{sorted(VALID_MATERIAL_TYPES)}"
            )

        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        return self.materials_repo.create(
            session_id=session_id,
            material_type=material_type,  # type: ignore[arg-type]
            title=title,
            content=content,
            source_url=source_url,
        )
