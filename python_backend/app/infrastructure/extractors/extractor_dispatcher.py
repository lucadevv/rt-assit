"""Composite extractor that dispatches to the first extractor that handles the file.

Order matters — specific extractors must come before TextExtractor (which
claims everything as fallback)."""
from typing import Optional

from app.application.ports.document_extractor import DocumentExtractor
from app.domain.entities.document import ExtractedDoc
from app.infrastructure.extractors.docx_extractor import DOCXExtractor
from app.infrastructure.extractors.markdown_extractor import MarkdownExtractor
from app.infrastructure.extractors.pdf_extractor import PDFExtractor
from app.infrastructure.extractors.text_extractor import TextExtractor


class ExtractorDispatcher(DocumentExtractor):
    """Holds an ordered list of extractors and dispatches to the first match."""

    def __init__(self, extractors: list[DocumentExtractor]) -> None:
        self.extractors = extractors

    def can_extract(self, filename: str, content_type: Optional[str] = None) -> bool:
        return any(e.can_extract(filename, content_type) for e in self.extractors)

    def extract(self, filename: str, data: bytes) -> ExtractedDoc:
        for e in self.extractors:
            if e.can_extract(filename):
                return e.extract(filename, data)
        # TextExtractor in default chain always returns True; this branch is
        # only reachable if a custom dispatcher is built without a fallback.
        raise RuntimeError(f"no extractor for filename: {filename!r}")


def build_default_dispatcher() -> ExtractorDispatcher:
    """Default extractor chain: PDF -> DOCX -> Markdown -> Text (fallback)."""
    return ExtractorDispatcher(
        [
            PDFExtractor(),
            DOCXExtractor(),
            MarkdownExtractor(),
            TextExtractor(),
        ]
    )
