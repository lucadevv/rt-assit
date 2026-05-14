"""EnsureUserExists — idempotent upsert based on AuthClaims.

Called from the auth middleware on every authenticated request. Creates the
User row on first sign-in, or refreshes email/name/avatar if Clerk has newer
values. Never overwrites the user's tier."""
from app.application.ports.auth_validator import AuthClaims
from app.application.ports.users_repository import UsersRepository
from app.domain.entities.user import User


class EnsureUserExistsUseCase:
    """Idempotent upsert of the user row from validated AuthClaims."""

    def __init__(self, users_repo: UsersRepository) -> None:
        self.users_repo = users_repo

    def execute(self, *, claims: AuthClaims) -> User:
        # Email is required for upsert. Synthesise a placeholder if Clerk
        # didn't include it (some social providers omit email scope).
        email = claims.email or f"{claims.user_id}@unknown.local"
        return self.users_repo.upsert(
            user_id=claims.user_id,
            email=email,
            name=claims.name,
            avatar_url=claims.avatar_url,
        )
