"""Port for token validation.

Implementations:
- ClerkJWTValidator (production) — validates Clerk-issued JWTs via JWKS.
- DevModeValidator (local dev) — synthesises a default user without Clerk."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class AuthClaims:
    """Validated claims extracted from a token.

    ``user_id`` is the stable external id (Clerk ``sub`` or ``dev_default``).
    Other fields populate the User entity on first sign-in via the upsert."""

    user_id: str
    email: Optional[str]
    name: Optional[str]
    avatar_url: Optional[str]


class AuthValidator(ABC):
    """Validates a token and returns claims, or raises UnauthorizedError."""

    @abstractmethod
    async def validate(self, token: str) -> AuthClaims:
        """Validate a bearer token. Raises UnauthorizedError on failure."""
        ...
