"""FastAPI auth dependency — `get_current_user`.

Flow:
  1. Resolve the access token from EITHER:
       (a) Authorization: Bearer <jwt> header  — legacy / migration
       (b) ``susurra_access`` HttpOnly cookie  — Auth Fase A canonical
     Bearer takes precedence so existing clients keep working
     unchanged while the cookie path rolls out.
  2. If missing and AUTH_MODE=dev, synthesise dev_default user.
  3. If missing and AUTH_MODE=clerk/custom, return 401.
  4. Validate token via AuthValidator port.
  5. Idempotent upsert of User row (EnsureUserExistsUseCase).
  6. Return User domain entity, available to routers via Depends.

The Spanish error string ``Falta header Authorization`` is preserved
for compat with NFR-9 / existing UI translations — even though we now
also accept a cookie, the user-facing message keeps pointing at the
historical header so support docs don't need to change. Fase D will
update the wording when the Bearer path is removed."""
import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status

from app.application.ports.auth_validator import AuthValidator
from app.application.use_cases.ensure_user_exists import EnsureUserExistsUseCase
from app.domain.entities.user import User
from app.domain.exceptions import UnauthorizedError
from app.presentation.api.cookies import ACCESS_COOKIE
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
    request: Request,
    authorization: Optional[str] = Header(default=None),
    auth: AuthValidator = Depends(get_auth_validator),
    ensure_user: EnsureUserExistsUseCase = Depends(get_ensure_user_exists_use_case),
) -> User:
    """Resolve the authenticated user, creating the row on first sign-in.

    Bearer header wins over cookie so legacy callers (still using the
    Authorization header) bypass the cookie path entirely — they don't
    even need to hold a cookie. Cookie is the fallback used by the
    Fase A frontend that no longer sends Bearer headers.

    Spanish error messages preserved (NFR-9)."""
    token = _extract_token(authorization)

    if token is None:
        token = request.cookies.get(ACCESS_COOKIE)
        if token == "":
            # Empty cookie value is treated as "not set" — same as missing.
            token = None

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
