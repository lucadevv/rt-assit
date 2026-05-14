"""Upload document from a URL — async extract, validate, persist."""
from typing import Optional

from app.application.ports.document_extractor import URLExtractor
from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.users_repository import UsersRepository
from app.application.use_cases.extract_identity_name import (
    ExtractIdentityNameUseCase,
    maybe_backfill_user_name,
)
from app.domain.entities.document import VALID_DOC_TYPES, Document
from app.domain.exceptions import ExtractionError, ValidationError


class UploadDocumentFromURLUseCase:
    def __init__(
        self,
        repo: DocumentsRepository,
        url_extractor: URLExtractor,
        users_repo: Optional[UsersRepository] = None,
        identity_name_extractor: Optional[ExtractIdentityNameUseCase] = None,
    ) -> None:
        self.repo = repo
        self.url_extractor = url_extractor
        self.users_repo = users_repo
        self.identity_name_extractor = (
            identity_name_extractor or ExtractIdentityNameUseCase()
        )

    async def execute(
        self,
        *,
        user_id: str,
        url: str,
        doc_type: str,
        scenario: Optional[str],
    ) -> Document:
        if doc_type not in VALID_DOC_TYPES:
            raise ValidationError("doc_type inválido")

        try:
            extracted = await self.url_extractor.extract(url)
        except Exception as e:  # noqa: BLE001
            raise ExtractionError(f"url_inalcanzable: {e}") from e

        if not extracted.content.strip():
            raise ExtractionError("no se pudo extraer contenido de la URL")

        doc_id = self.repo.add(
            user_id=user_id,
            doc_type=doc_type,
            scenario=scenario,
            title=extracted.title,
            content=extracted.content,
            source=extracted.source,
            metadata={"format": "url"},
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
