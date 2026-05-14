"""Health-check endpoint (B8 — extended).

GET /health probes DB + LLM + storage and returns:
- 200 OK when all probes are ``"ok"`` or ``"degraded"``.
- 503 Service Unavailable when any probe is ``"down"``.

The endpoint is exempt from rate limiting (see RateLimitMiddleware) so
load balancers + monitoring can hit it freely."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.application.use_cases.get_health_status import GetHealthStatusUseCase
from app.presentation.api.schemas import HealthResponse


router = APIRouter()


def _aggregate_status(checks: dict[str, str]) -> tuple[str, int]:
    """Return ``(overall, http_code)`` for a probe map."""
    if any(v == "down" for v in checks.values()):
        return "down", 503
    if any(v == "degraded" for v in checks.values()):
        return "degraded", 200
    return "ok", 200


@router.get("/health")
async def health_check(
    use_case: GetHealthStatusUseCase = Depends(
        # Imported lazily so the deps wiring lives in deps.py only.
        lambda: _get_health_use_case()
    ),
):
    checks = await use_case.execute()
    overall, code = _aggregate_status(checks)
    return JSONResponse(
        status_code=code,
        content=HealthResponse(status=overall, checks=checks).model_dump(),
    )


def _get_health_use_case() -> GetHealthStatusUseCase:
    # Local import to avoid circular dependency at module load time.
    from app.presentation.deps import get_health_status_use_case

    return get_health_status_use_case()
