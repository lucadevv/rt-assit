"""AES-256-GCM implementation of APIKeyEncryptor (B8 — BYOK).

Master key is sourced from the ``SUSURRA_MASTER_KEY`` env var (base64url-
encoded 32 bytes). In dev mode (``AUTH_MODE=dev``) we fall back to a
deterministic zero-byte key so the container boots without operator
setup — that key MUST NEVER be used in production. The factory raises
in production when the env var is missing or malformed.

Wire format: ``base64url(nonce[12] ++ ciphertext_with_tag)``."""
from __future__ import annotations

import base64
import logging
import os
from typing import Final

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.application.ports.api_key_encryptor import APIKeyEncryptor


logger = logging.getLogger(__name__)


_NONCE_BYTES: Final[int] = 12
_KEY_BYTES: Final[int] = 32  # AES-256


class AESGCMEncryptor(APIKeyEncryptor):
    def __init__(self, master_key: bytes) -> None:
        if len(master_key) != _KEY_BYTES:
            raise ValueError(
                f"AES-256 requires {_KEY_BYTES}-byte key, got {len(master_key)}"
            )
        self._cipher = AESGCM(master_key)

    def encrypt(self, plaintext: str) -> str:
        nonce = os.urandom(_NONCE_BYTES)
        ct = self._cipher.encrypt(nonce, plaintext.encode("utf-8"), None)
        return base64.urlsafe_b64encode(nonce + ct).decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        try:
            data = base64.urlsafe_b64decode(ciphertext.encode("ascii"))
        except Exception as e:  # noqa: BLE001
            raise ValueError("Ciphertext mal formado (base64 inválido)") from e
        if len(data) <= _NONCE_BYTES:
            raise ValueError("Ciphertext demasiado corto para descifrar")
        nonce, ct = data[:_NONCE_BYTES], data[_NONCE_BYTES:]
        plaintext = self._cipher.decrypt(nonce, ct, None)
        return plaintext.decode("utf-8")


def create_encryptor() -> APIKeyEncryptor:
    """Factory: SUSURRA_MASTER_KEY or dev fallback (zero key)."""
    key_b64 = os.getenv("SUSURRA_MASTER_KEY", "").strip()
    if not key_b64:
        if os.getenv("AUTH_MODE", "dev").lower() == "dev":
            logger.warning(
                "[Security] SUSURRA_MASTER_KEY not set — using DEV zero key. "
                "DO NOT USE IN PRODUCTION."
            )
            return AESGCMEncryptor(b"\x00" * _KEY_BYTES)
        raise RuntimeError(
            "SUSURRA_MASTER_KEY env var is required in production "
            "(base64url-encoded 32 bytes)"
        )

    try:
        key = base64.urlsafe_b64decode(key_b64.encode("ascii"))
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            "SUSURRA_MASTER_KEY must be base64url-encoded"
        ) from e

    if len(key) != _KEY_BYTES:
        raise RuntimeError(
            f"SUSURRA_MASTER_KEY must decode to {_KEY_BYTES} bytes, "
            f"got {len(key)}"
        )

    return AESGCMEncryptor(key)
