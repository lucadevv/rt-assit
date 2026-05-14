"""Upload document from pasted plain text."""
from typing import Optional

from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.users_repository import UsersRepository
from app.application.use_cases.extract_identity_name import (
    ExtractIdentityNameUseCase,
    maybe_backfill_user_name,
)
from app.domain.entities.document import VALID_DOC_TYPES, Document
from app.domain.exceptions import ExtractionError, ValidationError


class UploadDocumentFromTextUseCase:
    def __init__(
        self,
        repo: DocumentsRepository,
        users_repo: Optional[UsersRepository] = None,
        identity_name_extractor: Optional[ExtractIdentityNameUseCase] = None,
    ) -> None:
        self.repo = repo
        self.users_repo = users_repo
        self.identity_name_extractor = (
            identity_name_extractor or ExtractIdentityNameUseCase()
        )

    def execute(
        self,
        *,
        user_id: str,
        title: str,
        text: str,
        doc_type: str,
        scenario: Optional[str],
    ) -> Document:
        if doc_type not in VALID_DOC_TYPES:
            raise ValidationError("doc_type inválido")
        if not text.strip():
            raise ExtractionError("texto vacío")

        final_title = title or "(sin título)"
        doc_id = self.repo.add(
            user_id=user_id,
            doc_type=doc_type,
            scenario=scenario,
            title=final_title,
            content=text,
            source="pasted",
            metadata={"format": "text"},
        )
        doc = self.repo.get(doc_id, user_id)
        if doc is None:
            raise RuntimeError("failed to read back inserted document")

        maybe_backfill_user_name(
            users_repo=self.users_repo,
            extractor=self.identity_name_extractor,
            user_id=user_id,
            document=doc,
        )
        return doc
