"""Plain-text extractor — also serves as fallback for unknown formats."""
from typing import Optional

from app.application.ports.document_extractor import DocumentExtractor
from app.domain.entities.document import ExtractedDoc


class TextExtractor(DocumentExtractor):
    """Decode bytes as UTF-8. Always claims `can_extract=True` so it acts as fallback."""

    def can_extract(self, filename: str, content_type: Optional[str] = None) -> bool:
        return True

    def extract(self, filename: str, data: bytes) -> ExtractedDoc:
        text = data.decode("utf-8", errors="replace")
        title = filename.rsplit(".", 1)[0] if "." in filename else filename
        return ExtractedDoc(
            title=title,
            content=text,
            source=filename,
            detected_format="txt",
        )
