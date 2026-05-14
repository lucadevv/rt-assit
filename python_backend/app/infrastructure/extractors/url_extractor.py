"""Async URL extractor using httpx + trafilatura."""
from urllib.parse import urlparse

import httpx
import trafilatura

from app.application.ports.document_extractor import URLExtractor
from app.domain.entities.document import ExtractedDoc


class HTTPURLExtractor(URLExtractor):
    """Extracts main article content from a URL via trafilatura."""

    async def extract(self, url: str) -> ExtractedDoc:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 rtassist"},
            )
            resp.raise_for_status()
            html = resp.text

        extracted = trafilatura.extract(html) or ""
        title: str | None = None
        if html:
            metadata = trafilatura.extract_metadata(html)
            if metadata is not None:
                title = metadata.title

        parsed = urlparse(url)
        return ExtractedDoc(
            title=title or parsed.netloc or url,
            content=extracted,
            source=url,
            detected_format="url",
        )
