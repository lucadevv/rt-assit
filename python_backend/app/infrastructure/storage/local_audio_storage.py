"""LocalAudioStorage — dev-mode adapter for ``AudioStorage``.

Persists audio blobs to a local directory. Generates HMAC-signed URLs
that point to a private dev-only HTTP endpoint
(``GET /api/internal/recordings/{path}?token=...``).

The HMAC token format is base64url-encoded JSON containing:
  {"k": <key>, "exp": <unix-seconds>, "sig": <hex>}
where ``sig`` = HMAC-SHA256(secret, f"{key}|{exp}").

The endpoint must validate (1) the signature, (2) the expiry, and (3) the
key matches the path segment. See ``presentation/api/recordings_router.py``
for the verifier.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

from app.application.ports.audio_storage import AudioStorage


logger = logging.getLogger(__name__)


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_local_token(*, key: str, secret: str, expires_seconds: int) -> str:
    """Build a self-contained HMAC token. Used by the storage adapter to
    generate URLs and re-used by the presentation layer to validate them."""
    exp = int(time.time()) + max(60, int(expires_seconds))
    payload = f"{key}|{exp}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    blob = json.dumps({"k": key, "exp": exp, "sig": sig}, separators=(",", ":"))
    return _b64u(blob.encode("utf-8"))


def verify_local_token(
    *, token: str, expected_key: str, secret: str
) -> tuple[bool, str]:
    """Returns ``(valid, reason)``. Reason is empty on success."""
    try:
        # Pad base64url back to a multiple of 4.
        pad = "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode(token + pad)
        data = json.loads(raw.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        return False, f"token malformado: {e}"

    if data.get("k") != expected_key:
        return False, "key mismatch"
    exp = int(data.get("exp", 0))
    if exp < int(time.time()):
        return False, "token expirado"
    payload = f"{expected_key}|{exp}".encode("utf-8")
    expected_sig = hmac.new(
        secret.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_sig, str(data.get("sig", ""))):
        return False, "firma inválida"
    return True, ""


class LocalAudioStorage(AudioStorage):
    """Dev adapter: writes to ``base_dir / key`` and signs URLs with HMAC."""

    def __init__(
        self,
        *,
        base_dir: str,
        signing_secret: str,
        public_base_url: str,
    ) -> None:
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.signing_secret = signing_secret
        # Strip trailing slashes so we can compose URLs uniformly.
        self.public_base_url = public_base_url.rstrip("/")
        logger.info(
            f"[LocalAudioStorage] base_dir={self.base_dir} "
            f"public_base_url={self.public_base_url}"
        )

    # --- helpers ----------------------------------------------------------

    def _resolve_path(self, key: str) -> Path:
        """Join ``key`` onto ``base_dir`` and refuse path traversal.

        SECURITY: rejects keys that try to escape the base directory via
        ``..`` segments or absolute paths. ``Path.resolve`` normalises and
        we re-check the prefix afterwards."""
        # Disallow absolute / windows drive paths early.
        if os.path.isabs(key) or ".." in Path(key).parts:
            raise ValueError(f"Storage key inválida: {key}")
        target = (self.base_dir / key).resolve()
        # Defensive belt-and-suspenders: ensure resolved path stays inside.
        try:
            target.relative_to(self.base_dir)
        except ValueError as e:
            raise ValueError(f"Storage key fuera del base_dir: {key}") from e
        return target

    # --- AudioStorage API -------------------------------------------------

    async def upload(
        self, *, key: str, data: bytes, content_type: str
    ) -> dict[str, Any]:
        target = self._resolve_path(key)
        target.parent.mkdir(parents=True, exist_ok=True)

        def _write() -> int:
            with open(target, "wb") as f:
                f.write(data)
            return len(data)

        size = await asyncio.to_thread(_write)
        return {"size_bytes": size, "content_type": content_type, "key": key}

    async def get_signed_url(
        self, key: str, *, expires_seconds: int = 3600
    ) -> str:
        token = sign_local_token(
            key=key,
            secret=self.signing_secret,
            expires_seconds=expires_seconds,
        )
        # quote() encodes embedded slashes safely. We pass them through
        # because the recordings_router declares ``{key:path}``.
        path = quote(key, safe="/")
        return (
            f"{self.public_base_url}/api/internal/recordings/{path}"
            f"?token={token}"
        )

    async def delete(self, key: str) -> bool:
        target = self._resolve_path(key)

        def _rm() -> bool:
            try:
                target.unlink()
                return True
            except FileNotFoundError:
                return False

        existed = await asyncio.to_thread(_rm)
        # Best-effort prune empty parent dirs (don't blow up if they aren't).
        try:
            parent = target.parent
            while parent != self.base_dir and parent.exists():
                if any(parent.iterdir()):
                    break
                parent.rmdir()
                parent = parent.parent
        except OSError:
            pass
        return existed

    async def exists(self, key: str) -> bool:
        target = self._resolve_path(key)
        return await asyncio.to_thread(target.is_file)
