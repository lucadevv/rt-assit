"""Document extractor port — strategy for turning raw bytes into ExtractedDoc."""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.document import ExtractedDoc


class DocumentExtractor(ABC):
    """Strategy: extract text from a source. Implementations dispatch by file type."""

    @abstractmethod
    def can_extract(self, filename: str, content_type: Optional[str] = None) -> bool:
        """Return True if this extractor handles this file."""
        ...

    @abstractmethod
    def extract(self, filename: str, data: bytes) -> ExtractedDoc:
        """Extract text from raw bytes. Raises ExtractionError on unrecoverable failure."""
        ...


class URLExtractor(ABC):
    """Async extractor for URL sources (uses httpx)."""

    @abstractmethod
    async def extract(self, url: str) -> ExtractedDoc: ...
