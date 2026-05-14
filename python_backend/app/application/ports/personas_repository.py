"""Personas repository port."""
from __future__ import annotations

from typing import Optional, Protocol

from app.domain.entities.persona import Persona, PersonaTone


class PersonasRepository(Protocol):
    def create(
        self,
        *,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        scenario_id: Optional[str] = None,
        icon: Optional[str] = None,
        tone: Optional[PersonaTone] = None,
        custom_instructions: Optional[str] = None,
        is_default: bool = False,
    ) -> Persona: ...

    def get(self, persona_id: int, *, user_id: str) -> Optional[Persona]: ...

    def get_default(self, user_id: str) -> Optional[Persona]: ...

    def list_for_user(self, user_id: str) -> list[Persona]: ...

    def update(
        self,
        *,
        persona_id: int,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        scenario_id: Optional[str] = None,
        icon: Optional[str] = None,
        tone: Optional[PersonaTone] = None,
        custom_instructions: Optional[str] = None,
    ) -> Persona: ...

    def set_default(self, persona_id: int, *, user_id: str) -> Persona:
        """Mark this persona as default for user. Transactionally clear any
        previous default."""
        ...

    def delete(self, persona_id: int, *, user_id: str) -> bool: ...

    # ----- persona_documents link table -----

    def link_document(
        self,
        *,
        persona_id: int,
        document_id: int,
        is_identity: bool,
        user_id: str,
    ) -> None:
        """Link a document to a persona. Validates document ownership
        before linking."""
        ...

    def unlink_document(
        self,
        *,
        persona_id: int,
        document_id: int,
        user_id: str,
    ) -> bool: ...

    def list_documents(
        self,
        *,
        persona_id: int,
        user_id: str,
        is_identity: Optional[bool] = None,
    ) -> list[int]:
        """Return doc ids linked to a persona. ``is_identity`` filters by
        the flag; None returns all."""
        ...
