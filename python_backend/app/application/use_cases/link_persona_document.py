"""Link a document to a persona.

Ownership is validated inside the repo (both the persona and the document
must belong to ``user_id``). The repo raises PermissionError for cross-user
attempts which we map to NotFoundError so the API doesn't leak the
existence of other users' rows.
"""
from __future__ import annotations

from app.application.ports.personas_repository import PersonasRepository
from app.domain.exceptions import NotFoundError


class LinkPersonaDocumentUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        persona_id: int,
        document_id: int,
        is_identity: bool,
        user_id: str,
    ) -> None:
        try:
            self.repo.link_document(
                persona_id=persona_id,
                document_id=document_id,
                is_identity=is_identity,
                user_id=user_id,
            )
        except PermissionError as e:
            raise NotFoundError(str(e)) from e
