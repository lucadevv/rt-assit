"""Security headers + A11Y headers middleware (B8).

Applies on every response, including error responses. HSTS only when
the request was served over HTTPS (avoids breaking local HTTP dev).

Headers set:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: minimal (denies geo/mic/camera by default)
- Content-Security-Policy: tight default for API (no scripts, no inline)
- Strict-Transport-Security: 1y (HTTPS only)
"""
from __future__ import annotations

from typing import Awaitable, Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


_DEFAULT_CSP = (
    "default-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'"
)
_DEFAULT_PERMISSIONS_POLICY = (
    "geolocation=(), microphone=(), camera=(), payment=()"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        content_security_policy: str = _DEFAULT_CSP,
        permissions_policy: str = _DEFAULT_PERMISSIONS_POLICY,
        hsts_max_age: int = 31536000,
    ) -> None:
        super().__init__(app)
        self.csp = content_security_policy
        self.permissions = permissions_policy
        self.hsts_max_age = hsts_max_age

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable],
    ):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = self.permissions
        response.headers["Content-Security-Policy"] = self.csp

        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                f"max-age={self.hsts_max_age}; includeSubDomains"
            )

        return response
