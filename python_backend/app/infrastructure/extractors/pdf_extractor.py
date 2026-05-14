"""PDF extractor using pypdf."""
from io import BytesIO
from typing import Optional

from pypdf import PdfReader

from app.application.ports.document_extractor import DocumentExtractor
from app.domain.entities.document import ExtractedDoc


class PDFExtractor(DocumentExtractor):
    def can_extract(self, filename: str, content_type: Optional[str] = None) -> bool:
        return filename.lower().endswith(".pdf")

    def extract(self, filename: str, data: bytes) -> ExtractedDoc:
        reader = PdfReader(BytesIO(data))
        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text.strip())
        content = "\n\n".join(pages)
        title = filename.rsplit(".", 1)[0] if "." in filename else filename
        return ExtractedDoc(
            title=title,
            content=content,
            source=filename,
            detected_format="pdf",
        )
