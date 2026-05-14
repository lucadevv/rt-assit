"""Update a document (partial: title, content, and/or is_primary).

Wave 2A: ``is_primary`` is the "Principal" star toggle from the frontend
knowledge view. Promoting a doc to primary cascades: every OTHER identity
doc (cv / profile / linkedin / bio) in the same scope is unmarked first,
so the single-primary invariant holds without the client having to
orchestrate it. Scope = (user_id, scenario_id OR scenario IS NULL)
within ``IDENTITY_DOC_TYPES``.
"""
from typing import Optional

from app.application.ports.documents_repository import DocumentsRepository
from app.domain.entities.document import IDENTITY_DOC_TYPES, Document
from app.domain.exceptions import NotFoundError


class UpdateDocumentUseCase:
    def __init__(self, repo: DocumentsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        user_id: str,
        doc_id: int,
        title: Optional[str] = None,
        content: Optional[str] = None,
        is_primary: Optional[bool] = None,
    ) -> Document:
        existing = self.repo.get(doc_id, user_id)
        if not existing:
            raise NotFoundError("no encontrado")

        # Cascade BEFORE the target update so the unmark + mark land
        # within the same logical operation (each SQL statement still
        # auto-commits in the SQLite repo, but the window is tight enough
        # that two near-simultaneous PATCHes don't produce two primaries).
        # Only cascades when promoting an identity doc — non-identity doc
        # types are unaffected, and demoting (is_primary=False) is a
        # plain field flip without any side-effect on siblings.
        if is_primary is True and existing.doc_type in IDENTITY_DOC_TYPES:
            self.repo.unmark_primary_for_scope(
                user_id=user_id,
                scenario_id=existing.scenario,
                identity_doc_types=IDENTITY_DOC_TYPES,
                exclude_doc_id=doc_id,
            )

        updated = self.repo.update(
            doc_id,
            user_id,
            title=title,
            content=content,
            is_primary=is_primary,
        )
        if not updated:
            raise NotFoundError("no encontrado")
        return updated
