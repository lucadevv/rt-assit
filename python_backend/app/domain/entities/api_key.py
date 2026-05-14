"""APIKey domain entity (B8 — BYOK tier).

User-supplied API key for external providers (groq/openai/anthropic/...).
The ciphertext is intentionally NOT exposed in the domain — only the
hint (``"sk-...4242"``) and metadata. Encryption + decryption happens in
the infrastructure layer via the APIKeyEncryptor port; the application
asks for the plaintext value only when proxying a call to the provider.

Security: domain entities are routinely serialized into HTTP responses,
so keeping the ciphertext out of the dataclass guarantees we cannot
accidentally leak it through a JSON encoder."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional


APIKeyProvider = Literal[
    "groq", "openai", "anthropic", "ollama", "deepgram"
]


VALID_API_KEY_PROVIDERS: set[str] = {
    "groq",
    "openai",
    "anthropic",
    "ollama",
    "deepgram",
}


@dataclass
class APIKey:
    """Public representation of a stored BYOK key.

    ``key_hint`` should be a redacted preview (e.g. last 4 chars). The
    actual ciphertext lives in the ``api_keys.key_encrypted`` column and
    is read by the infrastructure repo only on explicit ``get_decrypted``
    calls — never by ``list_for_user``."""

    id: int
    user_id: str
    provider: APIKeyProvider
    key_hint: str
    is_active: bool = True
    last_used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
