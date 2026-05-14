"""API-key (BYOK) use cases (B8).

The encryption boundary is enforced here: callers pass plaintext
``key`` to ``AddAPIKey``; the use case derives a hint, encrypts via the
``APIKeyEncryptor`` port, and persists ciphertext via the repo. The
plaintext NEVER leaves this layer except through
``GetActiveAPIKeyForProvider`` which is invoked exclusively by the
LLM/STT factories at provider call time."""
from __future__ import annotations

from typing import Optional

from app.application.ports.api_key_encryptor import APIKeyEncryptor
from app.application.ports.api_keys_repository import APIKeysRepository
from app.domain.entities.api_key import (
    APIKey,
    VALID_API_KEY_PROVIDERS,
)
from app.domain.exceptions import NotFoundError, ValidationError


def _make_hint(plaintext: str) -> str:
    """Render a redacted preview safe to expose in API responses.

    Format: ``"<prefix>...<last4>"`` where ``prefix`` is the first 3
    characters or a fixed ``"sk"`` if the key is too short."""
    s = plaintext.strip()
    if not s:
        return "***"
    if len(s) <= 8:
        return f"{s[:1]}***{s[-1:]}"
    prefix = s[:3]
    last4 = s[-4:]
    return f"{prefix}...{last4}"


class AddAPIKeyUseCase:
    def __init__(
        self,
        *,
        repo: APIKeysRepository,
        encryptor: APIKeyEncryptor,
    ) -> None:
        self.repo = repo
        self.encryptor = encryptor

    def execute(
        self, *, user_id: str, provider: str, key: str
    ) -> APIKey:
        if provider not in VALID_API_KEY_PROVIDERS:
            raise ValidationError(f"Proveedor inválido: {provider}")
        if not key or not key.strip():
            raise ValidationError("La API key no puede estar vacía")
        if len(key.strip()) < 8:
            raise ValidationError(
                "La API key parece demasiado corta para ser válida"
            )

        plaintext = key.strip()
        ciphertext = self.encryptor.encrypt(plaintext)
        hint = _make_hint(plaintext)
        return self.repo.create(
            user_id=user_id,
            provider=provider,
            key_encrypted=ciphertext,
            key_hint=hint,
        )


class ListAPIKeysUseCase:
    def __init__(self, repo: APIKeysRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str) -> list[APIKey]:
        return self.repo.list_for_user(user_id)


class DeleteAPIKeyUseCase:
    def __init__(self, repo: APIKeysRepository) -> None:
        self.repo = repo

    def execute(self, *, api_key_id: int, user_id: str) -> None:
        ok = self.repo.delete(api_key_id, user_id)
        if not ok:
            raise NotFoundError("API key no encontrada")


class GetActiveAPIKeyForProviderUseCase:
    """Decrypt + return the active BYOK plaintext for a provider, or
    None when the user has no key. Touches ``last_used_at`` on success."""

    def __init__(
        self,
        *,
        repo: APIKeysRepository,
        encryptor: APIKeyEncryptor,
    ) -> None:
        self.repo = repo
        self.encryptor = encryptor

    def execute(self, *, user_id: str, provider: str) -> Optional[str]:
        if provider not in VALID_API_KEY_PROVIDERS:
            raise ValidationError(f"Proveedor inválido: {provider}")
        ciphertext = self.repo.get_active_ciphertext(user_id, provider)
        if ciphertext is None:
            return None
        try:
            plaintext = self.encryptor.decrypt(ciphertext)
        except Exception as e:  # noqa: BLE001
            # Tampered or rotated master key — surface as not-found so
            # the caller can fall back to env-var keys.
            raise ValidationError(
                "No se pudo descifrar la API key (¿master key rotada?)"
            ) from e
        # Best-effort touch.
        try:
            self.repo.touch_last_used(user_id, provider)
        except Exception:  # noqa: BLE001
            pass
        return plaintext
