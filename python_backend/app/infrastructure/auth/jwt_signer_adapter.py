"""HS256 JWT signer (concrete adapter for ``JwtSigner`` port).

HS256 (HMAC-SHA256) so we don't need a key-pair — a single shared secret
in ``CUSTOM_AUTH_JWT_SECRET`` is enough for first-party login flows.
Clerk mode (RS256 + JWKS) keeps its own validator.

The secret is read on every call (not cached) so a docker-compose
restart picks up a rotated value without rebuilding the image. If the
secret is missing the adapter REFUSES to issue or verify tokens — empty
default is safer than a weak well-known fallback.

Auth Sprint A: ``JWT_TTL_SECONDS`` is 15 minutes. Access tokens are
short-lived; long-term session continuity is delegated to opaque
refresh tokens (``OpaqueRefreshTokenMinter``) that mint new access JWTs
via ``POST /api/auth/refresh``. The frontend keeps the access token in
memory and silently refreshes when a 401 lands on an authenticated
call. Refresh tokens are ALWAYS DB-validated (rotation on use), so
leaking an access JWT only grants up to 15 minutes of unauthorised
activity instead of a week."""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

import jwt

from app.application.ports.jwt_signer import JwtClaims, JwtSigner


logger = logging.getLogger(__name__)


_JWT_ALGO = "HS256"
_JWT_TTL_SECONDS = 15 * 60  # 15 minutes (access token, Auth Sprint A)


class JwtSignerAdapter(JwtSigner):
    """Concrete HS256 signer used in AUTH_MODE=custom."""

    @property
    def ttl_seconds(self) -> int:
        return _JWT_TTL_SECONDS

    def sign(self, user_id: str, email: str, is_admin: bool) -> str:
        secret = _secret()
        if not secret:
            raise RuntimeError(
                "CUSTOM_AUTH_JWT_SECRET no está configurado. "
                "AUTH_MODE=custom requiere un secreto fuerte (32 bytes random)."
            )
        now = int(time.time())
        payload: dict = {
            "sub": user_id,
            "email": email,
            "is_admin": is_admin,
            "iat": now,
            "exp": now + _JWT_TTL_SECONDS,
        }
        return jwt.encode(payload, secret, algorithm=_JWT_ALGO)

    def verify(self, token: str) -> Optional[JwtClaims]:
        secret = _secret()
        if not secret or not token:
            return None
        try:
            decoded = jwt.decode(
                token,
                secret,
                algorithms=[_JWT_ALGO],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "require": ["sub", "exp", "iat"],
                },
            )
            # TypedDict is structural — pyjwt returns a plain dict that
            # already matches the JwtClaims shape (sub/email/is_admin/
            # iat/exp). We don't narrow here because verify() callers
            # treat any deviation as a 401 anyway.
            return decoded  # type: ignore[return-value]
        except jwt.ExpiredSignatureError:
            logger.info("[custom-auth] token expirado")
            return None
        except jwt.PyJWTError as e:
            logger.warning(f"[custom-auth] token inválido: {e}")
            return None


def _secret() -> str:
    return os.getenv("CUSTOM_AUTH_JWT_SECRET", "").strip()
