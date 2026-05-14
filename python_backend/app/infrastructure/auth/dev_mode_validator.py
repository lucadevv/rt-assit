"""DevModeValidator — synthesises a single ``dev_default`` user.

Used when ``AUTH_MODE=dev`` so local developers don't need a Clerk instance.
The token value is ignored; this is intentional for local iteration."""
from app.application.ports.auth_validator import AuthClaims, AuthValidator


DEV_USER_ID = "dev_default"


class DevModeValidator(AuthValidator):
    """Always returns the same dev user — for local dev without Clerk.

    This is the same id pre-seeded in init_db() and the target of the legacy
    ``user_id='default'`` -> ``'dev_default'`` migration."""

    async def validate(self, token: str) -> AuthClaims:
        # name=None so the UPSERT's COALESCE preserves whatever name is in
        # the DB. The user is pre-seeded with "Dev User" in init_db(), so
        # this still works on first run; after the identity-name extractor
        # backfills user.name from an uploaded CV, returning a hard-coded
        # "Dev User" here would otherwise clobber the real name on every
        # request.
        return AuthClaims(
            user_id=DEV_USER_ID,
            email="dev@auri.local",
            name=None,
            avatar_url=None,
        )
