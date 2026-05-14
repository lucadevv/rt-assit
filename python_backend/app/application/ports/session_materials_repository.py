"""Session materials repository port."""
from __future__ import annotations

from typing import Optional, Protocol

from app.domain.entities.session_material import (
    SessionMaterial,
    SessionMaterialType,
)


class SessionMaterialsRepository(Protocol):
    def create(
        self,
        *,
        session_id: str,
        material_type: SessionMaterialType,
        title: Optional[str] = None,
        content: Optional[str] = None,
        source_url: Optional[str] = None,
    ) -> SessionMaterial: ...

    def list_for_session(self, session_id: str) -> list[SessionMaterial]: ...

    def delete(self, material_id: int, *, session_id: str) -> bool: ...
