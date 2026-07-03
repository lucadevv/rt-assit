"""Custom-auth REST endpoints (Phase 2 — AUTH_MODE=custom).

Routes:
  POST /api/auth/login    — email + password → access JWT (15min) +
                            refresh cookie (30d, rotate-on-use)
  POST /api/auth/refresh  — refresh cookie → new access JWT + rotated
                            refresh cookie
  POST /api/auth/logout   — revoke refresh cookie + clear both cookies

The endpoints are open to all AUTH_MODEs at the routing level so the
frontend can probe them unconditionally, but they only succeed when
``CUSTOM_AUTH_JWT_SECRET`` is configured AND the requested user has a
``password_hash`` row (set via POST /api/admin/users). In dev mode users
created through the Clerk/dev paths simply won't have a hash → 401.

Auth Fase A: login now writes BOTH a short-lived access cookie AND a
long-lived refresh cookie (HttpOnly, SameSite per env). For backward
compatibility during the migration window, the login + refresh
responses STILL include ``access_token`` in the body so legacy frontend
code that reads from localStorage continues to work. Fase D will
shrink the body to user-only."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.application.use_cases.login_user import LoginUserUseCase
from app.application.use_cases.logout_user import LogoutUserUseCase
from app.application.use_cases.refresh_access_token import (
    RefreshAccessTokenUseCase,
)
from app.domain.exceptions import UnauthorizedError
from app.presentation.api.cookies import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_access_cookie,
    set_refresh_cookie,
)
from app.presentation.api.schemas import (
    LoginRequest,
    LoginResponse,
    LoginUserPayload,
    RefreshResponse,
)
from app.presentation.deps import (
    get_login_user_use_case,
    get_logout_user_use_case,
    get_refresh_access_token_use_case,
)


router = APIRouter()


def _client_ip(request: Request) -> Optional[str]:
    """Pick a best-effort client IP for audit. Behind a proxy, the
    deploy-time reverse-proxy should set X-Forwarded-For; we honour the
    first hop if present, else fall back to the direct socket peer."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        first = fwd.split(",", 1)[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return None


@router.post("/api/auth/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    use_case: LoginUserUseCase = Depends(get_login_user_use_case),
) -> LoginResponse:
    try:
        result = use_case.execute(
            email=str(body.email),
            password=body.password,
            user_agent=request.headers.get("user-agent"),
            ip=_client_ip(request),
        )
    except UnauthorizedError as e:
        # Single 401 + single message for "user not found" and "bad
        # password" — never reveal which leg failed.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
        ) from e
    except RuntimeError as e:
        # JWT secret missing — operator misconfiguration. 503 makes it
        # clearer than a generic 500 that the server can't sign tokens.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth_not_configured",
        ) from e

    # HttpOnly cookies — the source of truth for the new flow.
    set_access_cookie(response, result.access_token, result.access_expires_in)
    set_refresh_cookie(response, result.refresh_token, result.refresh_expires_in)

    # Body still carries access_token for backward compat with Bearer
    # callers (frontend Fase B will drop this branch).
    return LoginResponse(
        access_token=result.access_token,
        token_type="bearer",
        expires_in=result.access_expires_in,
        user=LoginUserPayload(
            id=result.user.id,
            email=result.user.email,
            is_admin=result.user.is_admin,
        ),
    )


@router.post("/api/auth/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    response: Response,
    use_case: RefreshAccessTokenUseCase = Depends(
        get_refresh_access_token_use_case
    ),
) -> RefreshResponse:
    """Rotate refresh + mint new access JWT.

    Reads the refresh secret from the ``susurra_refresh`` cookie. On
    failure clears both cookies so the browser stops sending stale
    credentials (forces a clean re-login flow)."""
    cookie_value = request.cookies.get(REFRESH_COOKIE)
    if not cookie_value:
        # No cookie → 401. Don't bother clearing (nothing to clear).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing_refresh_token",
        )

    try:
        result = use_case.execute(
            refresh_token_id=cookie_value,
            user_agent=request.headers.get("user-agent"),
            ip=_client_ip(request),
        )
    except UnauthorizedError as e:
        # Bad/expired/revoked refresh — clear cookies so the next
        # request from this browser starts from a clean state.
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_refresh_token",
        ) from e
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth_not_configured",
        ) from e

    set_access_cookie(response, result.access_token, result.access_expires_in)
    set_refresh_cookie(response, result.refresh_token, result.refresh_expires_in)

    return RefreshResponse(
        access_token=result.access_token,
        token_type="bearer",
        expires_in=result.access_expires_in,
        user=LoginUserPayload(
            id=result.user.id,
            email=result.user.email,
            is_admin=result.user.is_admin,
        ),
    )


@router.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    use_case: LogoutUserUseCase = Depends(get_logout_user_use_case),
) -> Response:
    """Revoke refresh + clear both cookies. Always 204, even if no
    refresh cookie was supplied (idempotent — already-logged-out is a
    no-op, not an error)."""
    cookie_value = request.cookies.get(REFRESH_COOKIE)
    use_case.execute(cookie_value)
    clear_auth_cookies(response)
    # FastAPI requires returning a Response for 204 — the implicit
    # response body must be empty per RFC 7230 §3.3.2.
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
