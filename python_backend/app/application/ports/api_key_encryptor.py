"""Port for symmetric encrypt/decrypt of BYOK API keys (B8).

Multi-impl: AES-256-GCM via ``cryptography`` (default). Could be swapped
for AWS KMS / Vault adapters in prod without touching the application
layer. Pure side-effect-free interface."""
from __future__ import annotations

from abc import ABC, abstractmethod


class APIKeyEncryptor(ABC):
    @abstractmethod
    def encrypt(self, plaintext: str) -> str:
        """Return base64url-encoded ciphertext (nonce ++ ct ++ tag)."""
        ...

    @abstractmethod
    def decrypt(self, ciphertext: str) -> str:
        """Reverse ``encrypt``. Raises ValueError on tamper / wrong key."""
        ...
