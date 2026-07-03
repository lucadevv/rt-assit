"""HttpOnly cookie helpers for auth (Auth Fase A).

Centralised so SameSite / Secure / Path choices stay consistent across
``/api/auth/login``, ``/api/auth/refresh`` and ``/api/auth/logout``.

Environment switch: ``SUSURRA_ENV`` (default ``dev``).
  dev  → SameSite=Lax,    Secure=false  (localhost http works)
  prod → SameSite=Strict, Secure=true   (HTTPS only)

Path discipline:
  access  cookie → Path=/         (sent on every API call)
  refresh cookie → Path=/api/auth (sent ONLY to login/refresh/logout —
                  reduces CSRF surface and accidental log leakage)"""
from __future__ import annotations

import os
from typing import Literal

from fastapi import Response


ACCESS_COOKIE = "susurra_access"
REFRESH_COOKIE = "susurra_refresh"

ACCESS_PATH = "/"
REFRESH_PATH = "/api/auth"


def _is_prod() -> bool:
    """Treat any non-'dev' value as production for safety. Empty or
    missing env var → dev (matches local docker-compose defaults)."""
    return os.getenv("SUSURRA_ENV", "dev").strip().lower() == "prod"


def _samesite() -> Literal["lax", "strict"]:
    return "strict" if _is_prod() else "lax"


def _secure() -> bool:
    return _is_prod()


def set_access_cookie(
    response: Response, token: str, max_age_seconds: int
) -> None:
    """Write the short-lived access-token cookie.

    Path=/ so every authenticated request (including REST + future SSR
    fetches) carries it. ``max_age`` mirrors the JWT exp so the browser
    drops the cookie at the same time the token expires server-side."""
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        secure=_secure(),
        samesite=_samesite(),
        path=ACCESS_PATH,
    )


def set_refresh_cookie(
    response: Response, token: str, max_age_seconds: int
) -> None:
    """Write the long-lived refresh-token cookie.

    Path=/api/auth so it is sent ONLY to the three auth endpoints —
    every other route (sessions, billing, etc.) never sees the refresh
    secret. Reduces the surface for accidental log capture and stops a
    rogue XSS-injected script from reading it via fetch() (HttpOnly is
    already JS-invisible; the path further narrows network leakage)."""
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        secure=_secure(),
        samesite=_samesite(),
        path=REFRESH_PATH,
    )


def clear_auth_cookies(response: Response) -> None:
    """Expire both auth cookies. Path must match the original ``set_*``
    call or the browser silently keeps the cookie alive — easy footgun.
    """
    response.delete_cookie(ACCESS_COOKIE, path=ACCESS_PATH)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)
