"""Admin/dev REST endpoints (B8).

Routes (dev-only — gated by ``AUTH_MODE=dev``):
  GET    /api/admin/jobs               — list background jobs
  POST   /api/admin/jobs/:id/retry     — re-mark a failed job as pending
  POST   /api/admin/jobs               — create a tracking record manually

Production should put real RBAC behind these — the placeholder check
mirrors the B5 cron-trigger admin pattern (dev mode only)."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.application.use_cases.manage_background_jobs import (
    CreateBackgroundJobUseCase,
    ListBackgroundJobsUseCase,
    MarkJobFailedUseCase,
)
from app.domain.exceptions import NotFoundError, ValidationError
from app.presentation.api.schemas import BackgroundJobResponse
from app.presentation.deps import (
    get_background_jobs_repository,
    get_create_background_job_use_case,
    get_list_background_jobs_use_case,
    get_mark_job_failed_use_case,
)


router = APIRouter()


def _require_dev_mode() -> None:
    if os.getenv("AUTH_MODE", "dev").lower() != "dev":
        raise HTTPException(
            status_code=404, detail="Endpoint disponible solo en modo dev"
        )


@router.get(
    "/api/admin/jobs", response_model=list[BackgroundJobResponse]
)
async def list_jobs(
    status: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    use_case: ListBackgroundJobsUseCase = Depends(
        get_list_background_jobs_use_case
    ),
) -> list[BackgroundJobResponse]:
    _require_dev_mode()
    try:
        jobs = use_case.execute(
            status=status, type=type, limit=limit, offset=offset
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return [BackgroundJobResponse.from_domain(j) for j in jobs]


@router.post(
    "/api/admin/jobs",
    response_model=BackgroundJobResponse,
    status_code=201,
)
async def create_job(
    body: dict = Body(...),
    use_case: CreateBackgroundJobUseCase = Depends(
        get_create_background_job_use_case
    ),
) -> BackgroundJobResponse:
    _require_dev_mode()
    try:
        job = use_case.execute(
            type=body.get("type", "generic"),
            payload=body.get("payload"),
            max_attempts=body.get("max_attempts", 3),
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return BackgroundJobResponse.from_domain(job)


@router.post(
    "/api/admin/jobs/{job_id}/retry",
    response_model=BackgroundJobResponse,
)
async def retry_job(job_id: str) -> BackgroundJobResponse:
    """Mark a failed job as pending so the next scheduler tick picks it
    up. The execution path itself lives in B5 cron handlers + B8 future
    Celery worker; this endpoint just resets the row."""
    _require_dev_mode()
    repo = get_background_jobs_repository()
    job = repo.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    # Re-mark via direct repo call (no use case yet — minimal surface
    # for B8). Bumps attempts so retry storms are visible in the UI.
    with_attempts = repo.increment_attempts(job_id)
    # Reset status to pending.
    from app.infrastructure.persistence.sqlite.db import get_conn

    with get_conn() as conn:
        conn.execute(
            """UPDATE background_jobs
               SET status = 'pending', error = NULL,
                   started_at = NULL, completed_at = NULL
               WHERE id = ?""",
            (job_id,),
        )
        conn.commit()
    refreshed = repo.get(job_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return BackgroundJobResponse.from_domain(refreshed)
