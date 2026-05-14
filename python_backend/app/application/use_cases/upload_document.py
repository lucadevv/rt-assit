"""Upload document from a file (multipart) — extract text, validate, persist."""
from typing import Optional

from app.application.ports.document_extractor import DocumentExtractor
from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.users_repository import UsersRepository
from app.application.use_cases.extract_identity_name import (
    ExtractIdentityNameUseCase,
    maybe_backfill_user_name,
)
from app.domain.entities.document import VALID_DOC_TYPES, Document
from app.domain.exceptions import ExtractionError, ValidationError


MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class UploadDocumentUseCase:
    def __init__(
        self,
        repo: DocumentsRepository,
        extractor: DocumentExtractor,
        users_repo: Optional[UsersRepository] = None,
        identity_name_extractor: Optional[ExtractIdentityNameUseCase] = None,
    ) -> None:
        self.repo = repo
        self.extractor = extractor
        self.users_repo = users_repo
        self.identity_name_extractor = (
            identity_name_extractor or ExtractIdentityNameUseCase()
        )

    def execute(
        self,
        *,
        user_id: str,
        filename: str,
        data: bytes,
        doc_type: str,
        scenario: Optional[str],
        content_type: Optional[str] = None,
    ) -> Document:
        if doc_type not in VALID_DOC_TYPES:
            raise ValidationError(
                f"doc_type inválido. Debe ser uno de: {sorted(VALID_DOC_TYPES)}"
            )

        if len(data) > MAX_UPLOAD_BYTES:
            raise ValidationError("archivo demasiado grande (máx 10MB)")

        extracted = self.extractor.extract(filename, data)

        if not extracted.content.strip():
            raise ExtractionError("no se pudo extraer texto del archivo")

        doc_id = self.repo.add(
            user_id=user_id,
            doc_type=doc_type,
            scenario=scenario,
            title=extracted.title,
            content=extracted.content,
            source=extracted.source,
            metadata={"format": extracted.detected_format, "size_bytes": len(data)},
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
