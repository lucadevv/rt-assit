"""Fetch a single document by id."""
from app.application.ports.documents_repository import DocumentsRepository
from app.domain.entities.document import Document
from app.domain.exceptions import NotFoundError


class GetDocumentUseCase:
    def __init__(self, repo: DocumentsRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str, doc_id: int) -> Document:
        doc = self.repo.get(doc_id, user_id)
        if doc is None:
            raise NotFoundError("no encontrado")
        return doc
