"""Auth factory — selects the AuthValidator implementation by env mode.

AUTH_MODE values:
- ``dev``    (default) → DevModeValidator: synthesises ``dev_default`` user.
- ``clerk``            → ClerkJWTValidator: real Clerk JWT validation.
- ``custom``           → CustomAuthValidator: Susurra-issued HS256 JWTs."""
import logging
import os

from app.application.ports.auth_validator import AuthValidator
from app.infrastructure.auth.clerk_jwt_validator import (
    ClerkJWTValidator,
    from_env as clerk_from_env,
)
from app.infrastructure.auth.custom_auth_validator import CustomAuthValidator
from app.infrastructure.auth.dev_mode_validator import DevModeValidator


logger = logging.getLogger(__name__)


def get_auth_mode() -> str:
    return os.getenv("AUTH_MODE", "dev").strip().lower() or "dev"


def is_dev_mode() -> bool:
    return get_auth_mode() == "dev"


def create_auth_validator() -> AuthValidator:
    """Build the configured AuthValidator. Raises on unknown AUTH_MODE."""
    mode = get_auth_mode()
    if mode == "clerk":
        validator: ClerkJWTValidator = clerk_from_env()
        logger.info("AuthValidator: Clerk JWT (%s)", validator.jwks_url)
        return validator
    if mode == "custom":
        # Late import keeps the legacy dev/clerk paths free of the
        # users_repo dependency. The repo singleton lives in deps.py;
        # importing it here would create a presentation→infrastructure
        # circular import, so we go through the infrastructure-internal
        # factory directly.
        from app.infrastructure.persistence.sqlite.users_repository import (
            SQLiteUsersRepository,
        )

        secret_present = bool(
            os.getenv("CUSTOM_AUTH_JWT_SECRET", "").strip()
        )
        if not secret_present:
            logger.warning(
                "AuthValidator: AUTH_MODE=custom pero "
                "CUSTOM_AUTH_JWT_SECRET no está seteado — todos los "
                "tokens serán rechazados hasta que se configure."
            )
        logger.info("AuthValidator: custom HS256 JWT")
        return CustomAuthValidator(users_repo=SQLiteUsersRepository())
    if mode == "dev":
        logger.info("AuthValidator: dev mode (synthesises 'dev_default' user)")
        return DevModeValidator()
    raise RuntimeError(
        f"Unknown AUTH_MODE: {mode!r}. Expected 'dev', 'clerk' or 'custom'."
    )
