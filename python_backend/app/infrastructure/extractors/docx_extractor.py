"""DOCX extractor using python-docx."""
from io import BytesIO
from typing import Optional

from docx import Document as DocxDocument  # type: ignore[attr-defined]

from app.application.ports.document_extractor import DocumentExtractor
from app.domain.entities.document import ExtractedDoc


class DOCXExtractor(DocumentExtractor):
    def can_extract(self, filename: str, content_type: Optional[str] = None) -> bool:
        return filename.lower().endswith(".docx")

    def extract(self, filename: str, data: bytes) -> ExtractedDoc:
        doc = DocxDocument(BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        content = "\n".join(paragraphs)
        title = filename.rsplit(".", 1)[0] if "." in filename else filename
        return ExtractedDoc(
            title=title,
            content=content,
            source=filename,
            detected_format="docx",
        )
