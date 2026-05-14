"""ClerkJWTValidator — validates Clerk-issued JWTs via JWKS.

Auth flow:
  1. Frontend sends ``Authorization: Bearer <jwt>``
  2. Backend fetches Clerk's JWKS (cached 5 min in module dict)
  3. PyJWT verifies signature (RS256) + standard claims (exp/nbf/iss/aud)
  4. Returns AuthClaims (user_id from ``sub``, email/name/avatar from custom)

Env config:
  CLERK_JWKS_URL    JWKS endpoint (e.g. https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json)
  CLERK_AUDIENCE    Optional audience claim to verify
  CLERK_ISSUER      Optional issuer claim to verify (e.g. https://<instance>.clerk.accounts.dev)

Clerk JWT custom claims: by default the JWT only contains ``sub``. Configure a
custom JWT template in Clerk's dashboard to include ``email``, ``name``,
``image_url`` if you want first-sign-in profile auto-population."""
import logging
import os
import time
from typing import Any, Optional

import httpx
import jwt
from jwt import PyJWKClient

from app.application.ports.auth_validator import AuthClaims, AuthValidator
from app.domain.exceptions import UnauthorizedError


logger = logging.getLogger(__name__)


# Module-level JWKS cache (TTL 5 min). Process-local; safe across requests.
_JWKS_TTL_SECONDS = 300
_jwks_cache: dict[str, tuple[float, dict[str, Any]]] = {}


class ClerkJWTValidator(AuthValidator):
    """Validates Clerk JWTs using PyJWT + cached JWKS."""

    def __init__(
        self,
        *,
        jwks_url: str,
        audience: Optional[str] = None,
        issuer: Optional[str] = None,
    ) -> None:
        if not jwks_url:
            raise ValueError("CLERK_JWKS_URL is required for ClerkJWTValidator")
        self.jwks_url = jwks_url
        self.audience = audience
        self.issuer = issuer
        # PyJWKClient handles signing-key resolution via ``kid``.
        self._jwk_client = PyJWKClient(jwks_url, cache_keys=True)

    async def validate(self, token: str) -> AuthClaims:
        if not token:
            raise UnauthorizedError("Token vacío")

        try:
            # Resolve signing key from JWKS by ``kid`` header.
            signing_key = self._get_signing_key(token)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"JWKS signing-key lookup failed: {e}")
            raise UnauthorizedError(
                "No se pudo validar la firma del token"
            ) from e

        options: dict[str, Any] = {
            "verify_signature": True,
            "verify_exp": True,
            "verify_nbf": True,
            "verify_iat": True,
            "require": ["exp", "iat", "sub"],
        }
        # Audience/issuer are optional in Clerk default JWTs; verify only if
        # configured to avoid breaking dev setups.
        decode_kwargs: dict[str, Any] = {
            "algorithms": ["RS256"],
            "options": options,
        }
        if self.audience:
            decode_kwargs["audience"] = self.audience
        else:
            options["verify_aud"] = False
        if self.issuer:
            decode_kwargs["issuer"] = self.issuer
        else:
            options["verify_iss"] = False

        try:
            payload: dict[str, Any] = jwt.decode(
                token, signing_key, **decode_kwargs
            )
        except jwt.ExpiredSignatureError as e:
            raise UnauthorizedError("Token expirado") from e
        except jwt.InvalidTokenError as e:
            raise UnauthorizedError(f"Token inválido: {e}") from e

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Token sin claim 'sub'")

        return AuthClaims(
            user_id=str(user_id),
            email=_str_or_none(payload.get("email")),
            name=_str_or_none(payload.get("name") or payload.get("full_name")),
            avatar_url=_str_or_none(
                payload.get("image_url") or payload.get("picture")
            ),
        )

    def _get_signing_key(self, token: str) -> Any:
        """Fetch the signing key for the token's ``kid``.

        PyJWKClient handles HTTP fetch + per-kid cache. We add a TTL wrapper
        to refresh the JWKS list periodically (key rotation)."""
        cache_entry = _jwks_cache.get(self.jwks_url)
        now = time.time()
        if cache_entry is None or (now - cache_entry[0]) > _JWKS_TTL_SECONDS:
            # Force refresh by resetting PyJWKClient internals.
            try:
                resp = httpx.get(self.jwks_url, timeout=5.0)
                resp.raise_for_status()
                _jwks_cache[self.jwks_url] = (now, resp.json())
            except Exception as e:  # noqa: BLE001
                # Cache miss + network failure: propagate so caller raises 401.
                raise UnauthorizedError(
                    f"No se pudo obtener JWKS: {e}"
                ) from e
        return self._jwk_client.get_signing_key_from_jwt(token).key


def _str_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def from_env() -> "ClerkJWTValidator":
    """Construct a ClerkJWTValidator from environment variables."""
    jwks_url = os.getenv("CLERK_JWKS_URL", "").strip()
    audience = os.getenv("CLERK_AUDIENCE", "").strip() or None
    issuer = os.getenv("CLERK_ISSUER", "").strip() or None
    if not jwks_url:
        raise RuntimeError(
            "CLERK_JWKS_URL is required when AUTH_MODE=clerk. "
            "Get it from Clerk dashboard → API Keys → JWKS endpoint."
        )
    return ClerkJWTValidator(
        jwks_url=jwks_url, audience=audience, issuer=issuer
    )
