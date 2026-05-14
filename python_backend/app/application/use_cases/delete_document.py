"""Delete a document by id."""
from app.application.ports.documents_repository import DocumentsRepository
from app.domain.exceptions import NotFoundError


class DeleteDocumentUseCase:
    def __init__(self, repo: DocumentsRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str, doc_id: int) -> None:
        if not self.repo.delete(doc_id, user_id):
            raise NotFoundError("no encontrado")
