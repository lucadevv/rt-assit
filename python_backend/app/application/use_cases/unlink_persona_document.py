"""Unlink a document from a persona."""
from __future__ import annotations

from app.application.ports.personas_repository import PersonasRepository
from app.domain.exceptions import NotFoundError


class UnlinkPersonaDocumentUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        persona_id: int,
        document_id: int,
        user_id: str,
    ) -> None:
        ok = self.repo.unlink_document(
            persona_id=persona_id,
            document_id=document_id,
            user_id=user_id,
        )
        if not ok:
            raise NotFoundError("link no encontrado")
