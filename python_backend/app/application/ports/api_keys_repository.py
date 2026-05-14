"""Repository port for BYOK API keys (B8).

The repo stores opaque ciphertext (set by the application layer via the
``APIKeyEncryptor`` port). It NEVER decrypts — that responsibility lives
on the application layer's ``GetActiveAPIKeyForProvider`` use case so
the decryption flow stays explicit + audit-friendly."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.api_key import APIKey


class APIKeysRepository(ABC):
    @abstractmethod
    def create(
        self,
        *,
        user_id: str,
        provider: str,
        key_encrypted: str,
        key_hint: str,
    ) -> APIKey:
        """Insert (or replace, since UNIQUE(user_id, provider)) and return
        the public APIKey entity (without ciphertext)."""
        ...

    @abstractmethod
    def get(self, api_key_id: int, user_id: str) -> Optional[APIKey]:
        ...

    @abstractmethod
    def get_active_ciphertext(
        self, user_id: str, provider: str
    ) -> Optional[str]:
        """Return the raw ciphertext if an active key exists for the
        ``(user_id, provider)`` pair, else None. Decryption is the
        caller's responsibility."""
        ...

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[APIKey]:
        ...

    @abstractmethod
    def delete(self, api_key_id: int, user_id: str) -> bool:
        """Return True iff a row was deleted."""
        ...

    @abstractmethod
    def touch_last_used(self, user_id: str, provider: str) -> None:
        """Stamp ``last_used_at`` after a successful proxy call."""
        ...
