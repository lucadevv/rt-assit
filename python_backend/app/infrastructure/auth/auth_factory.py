"""Auth factory — selects the AuthValidator implementation by env mode.

AUTH_MODE values:
- ``dev``   (default) → DevModeValidator: synthesises ``dev_default`` user.
- ``clerk``           → ClerkJWTValidator: real Clerk JWT validation."""
import logging
import os

from app.application.ports.auth_validator import AuthValidator
from app.infrastructure.auth.clerk_jwt_validator import (
    ClerkJWTValidator,
    from_env as clerk_from_env,
)
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
    if mode == "dev":
        logger.info("AuthValidator: dev mode (synthesises 'dev_default' user)")
        return DevModeValidator()
    raise RuntimeError(
        f"Unknown AUTH_MODE: {mode!r}. Expected 'dev' or 'clerk'."
    )
