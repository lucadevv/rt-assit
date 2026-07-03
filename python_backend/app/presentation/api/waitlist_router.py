"""Public waitlist endpoint — POST /api/waitlist.

Accepts a beta-tester signup from the landing page and emails the founder
via the active EmailSender. Strict per-IP rate-limit (5/hour) layered on
top of the global middleware to prevent landing-form spam regardless of
the broader 30/min public budget."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.application.ports.rate_limiter import RateLimiter
from app.application.use_cases.submit_waitlist import SubmitWaitlistUseCase
from app.presentation.deps import (
    build_submit_waitlist_use_case,
    get_rate_limiter,
)


logger = logging.getLogger(__name__)

router = APIRouter()


_WAITLIST_WINDOW_SECONDS = 60 * 60
_WAITLIST_MAX_PER_WINDOW = 5


class WaitlistRequest(BaseModel):
    email: EmailStr
    source: Optional[str] = Field(default="landing", max_length=64)


class WaitlistResponse(BaseModel):
    success: bool
    message: str


@router.post(
    "/api/waitlist",
    response_model=WaitlistResponse,
)
async def submit_waitlist(
    payload: WaitlistRequest,
    request: Request,
    use_case: SubmitWaitlistUseCase = Depends(build_submit_waitlist_use_case),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> WaitlistResponse:
    client_ip = _client_ip(request)
    key = f"waitlist:{client_ip}"
    try:
        allowed = await limiter.check_and_increment(
            key, _WAITLIST_MAX_PER_WINDOW, _WAITLIST_WINDOW_SECONDS
        )
    except Exception as e:  # noqa: BLE001 — fail-open on limiter error
        logger.warning(f"[Waitlist] rate limiter error, fail-open: {e}")
        allowed = True

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=(
                "Demasiados intentos desde tu IP. Probá de nuevo en una hora."
            ),
            headers={"Retry-After": str(_WAITLIST_WINDOW_SECONDS)},
        )

    source = (payload.source or "landing").strip() or "landing"
    result = await use_case.execute(email=str(payload.email), source=source)
    return WaitlistResponse(success=result.success, message=result.message)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host or "unknown"
    return "unknown"
