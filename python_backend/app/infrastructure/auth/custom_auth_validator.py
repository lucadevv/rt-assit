"""CustomAuthValidator — validates Susurra-issued JWTs (HS256).

Used when ``AUTH_MODE=custom``. Tokens are minted by
``infrastructure.auth.jwt_service.issue_jwt`` after a successful
``POST /api/auth/login`` and travel as ``Authorization: Bearer <jwt>``.

Mirrors the structure of ``ClerkJWTValidator`` so the auth middleware
can swap implementations through the ``AuthValidator`` port without any
router-level change."""
from typing import Optional

from app.application.ports.auth_validator import AuthClaims, AuthValidator
from app.application.ports.jwt_signer import JwtSigner
from app.application.ports.users_repository import UsersRepository
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.auth.jwt_signer_adapter import JwtSignerAdapter


class CustomAuthValidator(AuthValidator):
    """Validates Susurra JWTs and resolves the persisted User row.

    The users_repo dependency lets us return profile fields (name,
    avatar) the JWT itself doesn't carry — the JWT is intentionally
    minimal (sub/email/is_admin) so token rotation doesn't depend on
    profile-data freshness.

    Auth Sprint A: the validator depends on the ``JwtSigner`` port for
    verification. The default ``JwtSignerAdapter()`` keeps the
    ``auth_factory`` wiring path simple (no need to thread the singleton
    through), but tests can inject any ``JwtSigner`` impl."""

    def __init__(
        self,
        *,
        users_repo: UsersRepository,
        jwt_signer: Optional[JwtSigner] = None,
    ) -> None:
        self.users_repo = users_repo
        self.jwt_signer: JwtSigner = jwt_signer or JwtSignerAdapter()

    async def validate(self, token: str) -> AuthClaims:
        if not token:
            raise UnauthorizedError("Token vacío")

        claims = self.jwt_signer.verify(token)
        if claims is None:
            raise UnauthorizedError("Token inválido o expirado")

        user_id = _str_or_none(claims.get("sub"))
        if not user_id:
            raise UnauthorizedError("Token sin claim 'sub'")

        email_claim = _str_or_none(claims.get("email"))

        user = self.users_repo.get_by_id(user_id)
        if user is None:
            raise UnauthorizedError("Usuario no encontrado")

        return AuthClaims(
            user_id=user.id,
            email=user.email or email_claim,
            name=user.name,
            avatar_url=user.avatar_url,
        )


def _str_or_none(v: object) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None
