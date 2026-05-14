"""Repository port for documents persistence."""
from abc import ABC, abstractmethod
from typing import Any, Optional

from app.domain.entities.document import Document


class DocumentsRepository(ABC):
    """Abstract documents store. Implementations: SQLite (current), Postgres (future)."""

    @abstractmethod
    def add(
        self,
        user_id: str,
        doc_type: str,
        title: str,
        content: str,
        scenario: Optional[str] = None,
        source: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> int:
        """Persist a new document and return its id."""
        ...

    @abstractmethod
    def list(
        self,
        user_id: str,
        scenario: Optional[str] = None,
        doc_type: Optional[str] = None,
        include_global: bool = True,
    ) -> list[Document]:
        """List documents for user. Optionally filtered by scenario / doc_type."""
        ...

    @abstractmethod
    def get(self, doc_id: int, user_id: str) -> Optional[Document]:
        """Fetch a document by id, scoped to user."""
        ...

    @abstractmethod
    def delete(self, doc_id: int, user_id: str) -> bool:
        """Delete a document by id, scoped to user. Returns True if deleted."""
        ...

    @abstractmethod
    def update(
        self,
        doc_id: int,
        user_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        is_primary: Optional[bool] = None,
    ) -> Optional[Document]:
        """Partial update of a document scoped to user. None values are skipped."""
        ...

    @abstractmethod
    def unmark_primary_for_scope(
        self,
        *,
        user_id: str,
        scenario_id: Optional[str],
        identity_doc_types: set[str],
        exclude_doc_id: Optional[int] = None,
    ) -> None:
        """Clear ``is_primary`` for every doc in the given scope.

        Scope is (user_id, scenario_id OR scenario IS NULL) AND
        doc_type IN identity_doc_types AND id != exclude_doc_id. Used to
        enforce the single-primary invariant when promoting a new doc.
        """
        ...
