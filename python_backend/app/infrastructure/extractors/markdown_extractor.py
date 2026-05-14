"""Markdown extractor — keeps markdown as plain text."""
from typing import Optional

from app.application.ports.document_extractor import DocumentExtractor
from app.domain.entities.document import ExtractedDoc


class MarkdownExtractor(DocumentExtractor):
    def can_extract(self, filename: str, content_type: Optional[str] = None) -> bool:
        lower = filename.lower()
        return lower.endswith(".md") or lower.endswith(".markdown")

    def extract(self, filename: str, data: bytes) -> ExtractedDoc:
        text = data.decode("utf-8", errors="replace")
        title = filename.rsplit(".", 1)[0] if "." in filename else filename
        return ExtractedDoc(
            title=title,
            content=text,
            source=filename,
            detected_format="md",
        )
