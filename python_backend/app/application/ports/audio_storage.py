"""Audio storage port (B6).

Two implementations are wired via STORAGE_MODE:
- ``local`` (dev): local disk under ``LOCAL_STORAGE_DIR`` with HMAC-signed
  internal URLs.
- ``s3`` (prod / MinIO): S3-compatible bucket with presigned ``get_object`` URLs.

The port hides every backend detail behind an opaque ``key`` (storage object
identifier). Callers never see paths or buckets."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class AudioStorage(ABC):
    """Abstract audio file storage. Async-first because the prod adapter is
    network-bound and the dev adapter wraps disk IO in ``asyncio.to_thread``
    so the API stays uniform."""

    @abstractmethod
    async def upload(
        self, *, key: str, data: bytes, content_type: str
    ) -> dict[str, Any]:
        """Persist ``data`` at ``key``. Returns metadata at minimum:

            {"size_bytes": int, "content_type": str}

        Implementations may include extra keys (etag, version_id, etc.)."""
        ...

    @abstractmethod
    async def get_signed_url(
        self, key: str, *, expires_seconds: int = 3600
    ) -> str:
        """Return a time-limited URL for downloading ``key``.

        Default lifetime is 1 hour. Local mode uses HMAC-signed query tokens;
        prod uses S3 presigned URLs."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete ``key`` from storage. Returns True iff the object existed
        and is now gone (idempotent — deleting a missing key returns False
        but never raises)."""
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Probe for ``key`` existence without downloading."""
        ...
