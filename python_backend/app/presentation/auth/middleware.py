"""FastAPI auth dependency — `get_current_user`.

Flow:
  1. Read Authorization header.
  2. If missing and AUTH_MODE=dev, synthesise dev_default user.
  3. If missing and AUTH_MODE=clerk, return 401.
  4. Validate token via AuthValidator port.
  5. Idempotent upsert of User row (EnsureUserExistsUseCase).
  6. Return User domain entity, available to routers via Depends."""
import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from app.application.ports.auth_validator import AuthValidator
from app.application.use_cases.ensure_user_exists import EnsureUserExistsUseCase
from app.domain.entities.user import User
from app.domain.exceptions import UnauthorizedError
from app.presentation.deps import (
    get_auth_validator,
    get_ensure_user_exists_use_case,
    is_dev_mode,
)


logger = logging.getLogger(__name__)


# Sentinel token used in dev mode when the request omits Authorization.
# DevModeValidator ignores the value, but we pass *something* to keep the
# port signature (token is required) consistent across implementations.
_DEV_SENTINEL_TOKEN = "dev-token"  # noqa: S105 — not a real secret


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    auth: AuthValidator = Depends(get_auth_validator),
    ensure_user: EnsureUserExistsUseCase = Depends(get_ensure_user_exists_use_case),
) -> User:
    """Resolve the authenticated user, creating the row on first sign-in.

    Spanish error messages preserved (NFR-9)."""
    token = _extract_token(authorization)

    if token is None:
        if is_dev_mode():
            token = _DEV_SENTINEL_TOKEN
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Falta header Authorization",
                headers={"WWW-Authenticate": "Bearer"},
            )

    try:
        claims = await auth.validate(token)
    except UnauthorizedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except Exception as e:  # noqa: BLE001
        # Don't leak internal validator errors.
        logger.warning(f"Auth validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    user = ensure_user.execute(claims=claims)

    # B5 — auto-start trial on every authenticated request (idempotent).
    # If the user already has any subscription, StartTrialUseCase returns
    # it unchanged. Failure is best-effort (won't block auth).
    try:
        from app.presentation.deps import build_start_trial_use_case

        build_start_trial_use_case().execute(user_id=user.id)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[Auth] auto-start-trial failed for {user.id}: {e}")

    return user


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    """Parse 'Bearer <token>'. Returns None if header missing or malformed."""
    if not authorization:
        return None
    parts = authorization.strip().split(maxsplit=1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None
