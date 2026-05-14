"""Rate-limiting middleware (B8).

Sliding-window per-key throttle. Per-user (JWT-derived) for authenticated
routes; per-IP for public/webhook. ``/health``, ``/docs``, ``/openapi.json``
and ``/redoc`` are exempt to keep ops + introspection tools usable when
the limiter is misconfigured.

Returns a 429 with a friendly Spanish message + ``Retry-After: 60`` so
clients can respect the limit. The ``RateLimiter`` port is async — the
in-memory adapter is a fast no-op under contention; the Redis adapter
will be a single round trip in prod."""
from __future__ import annotations

import logging
import os
from typing import Awaitable, Callable, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.application.ports.rate_limiter import RateLimiter


logger = logging.getLogger(__name__)


_EXEMPT_PATHS: set[str] = {
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        rate_limiter: RateLimiter,
        default_per_min: int = 100,
        public_per_min: int = 30,
        window_seconds: int = 60,
    ) -> None:
        super().__init__(app)
        self.limiter = rate_limiter
        self.default_per_min = default_per_min
        self.public_per_min = public_per_min
        self.window_seconds = window_seconds

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable],
    ):
        path = request.url.path

        # Always exempt introspection + health.
        if path in _EXEMPT_PATHS:
            return await call_next(request)

        # WebSocket upgrades bypass HTTP middleware in starlette anyway,
        # but be defensive: don't throttle non-HTTP scopes.
        if request.scope.get("type") != "http":
            return await call_next(request)

        key, limit = self._resolve_key_and_limit(request)
        if key is None:
            return await call_next(request)

        try:
            allowed = await self.limiter.check_and_increment(
                key, limit, self.window_seconds
            )
        except Exception as e:  # noqa: BLE001
            # Fail-open on limiter errors (don't block real users due to
            # an in-memory dict bug or a Redis blip).
            logger.warning(f"[RateLimit] Limiter error, fail-open: {e}")
            return await call_next(request)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": (
                        "Demasiadas solicitudes. Esperá un minuto antes de "
                        "volver a intentar."
                    ),
                    "retry_after_seconds": self.window_seconds,
                },
                headers={"Retry-After": str(self.window_seconds)},
            )

        return await call_next(request)

    def _resolve_key_and_limit(
        self, request: Request
    ) -> tuple[Optional[str], int]:
        """Pick a key + per-window limit for this request.

        Authenticated requests: ``user:<bearer>`` (token suffix is
        sufficient for dev — prod should use the validated subject).
        Public/webhook requests: ``ip:<host>:<path>``.
        """
        path = request.url.path
        auth = request.headers.get("authorization", "")
        is_dev = os.getenv("AUTH_MODE", "dev").lower() == "dev"

        if auth.startswith("Bearer ") or is_dev:
            # In dev, throttle per IP (since dev_default user collapses
            # everyone). In prod-ish (real Bearer header) bucket per
            # token suffix.
            if is_dev and not auth:
                client_ip = _client_ip(request)
                return f"ip:{client_ip}", self.default_per_min
            token_suffix = auth[7:][-32:]
            return f"user:{token_suffix}", self.default_per_min

        if (
            "/api/public/" in path
            or "/api/billing/webhook" in path
            or path.startswith("/api/plans")
            or path.startswith("/api/share/")
        ):
            client_ip = _client_ip(request)
            return f"ip:{client_ip}:{path}", self.public_per_min

        # Default: throttle per IP at the public limit.
        client_ip = _client_ip(request)
        return f"ip:{client_ip}", self.public_per_min


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host or "unknown"
    return "unknown"
