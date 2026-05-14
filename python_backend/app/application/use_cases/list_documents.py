"""List documents for the current user."""
from typing import Optional

from app.application.ports.documents_repository import DocumentsRepository
from app.domain.entities.document import Document


class ListDocumentsUseCase:
    def __init__(self, repo: DocumentsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        user_id: str,
        scenario: Optional[str] = None,
        doc_type: Optional[str] = None,
    ) -> list[Document]:
        return self.repo.list(user_id, scenario=scenario, doc_type=doc_type)
