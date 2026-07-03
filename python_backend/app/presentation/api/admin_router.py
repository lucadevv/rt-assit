"""Admin/dev REST endpoints (B8 + Phase 2).

Routes:
  GET    /api/admin/jobs               — list background jobs (dev-only)
  POST   /api/admin/jobs/:id/retry     — re-mark a failed job as pending (dev-only)
  POST   /api/admin/jobs               — create a tracking record manually (dev-only)
  POST   /api/admin/users              — create a user with bcrypt password
                                         (Phase 2 — gated by X-Admin-Token)

The dev-only endpoints are gated by ``AUTH_MODE=dev`` to avoid leaking
operational tools in production. The ``/api/admin/users`` endpoint is
gated by the ``X-Admin-Token`` shared secret (``SUSURRA_ADMIN_TOKEN``
env var) so the founder can bootstrap accounts in custom-auth mode."""
from __future__ import annotations

import os
import secrets as _secrets
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from app.application.ports.beta_invitations_repository import (
    BetaInvitationsRepository,
)
from app.application.use_cases.admin_create_user import AdminCreateUserUseCase
from app.application.use_cases.invite_beta_user import InviteBetaUserUseCase
from app.application.use_cases.manage_background_jobs import (
    CreateBackgroundJobUseCase,
    ListBackgroundJobsUseCase,
    MarkJobFailedUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import ConflictError, NotFoundError, ValidationError
from app.presentation.api.schemas import (
    BackgroundJobResponse,
    CreateUserRequest,
    CreateUserResponse,
    InvitationSummary,
    InviteBetaUserRequest,
    InviteBetaUserResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_admin_create_user_use_case,
    get_background_jobs_repository,
    get_beta_invitations_repository,
    get_create_background_job_use_case,
    get_invite_beta_user_use_case,
    get_list_background_jobs_use_case,
    get_mark_job_failed_use_case,
)


router = APIRouter()


def _require_dev_mode() -> None:
    if os.getenv("AUTH_MODE", "dev").lower() != "dev":
        raise HTTPException(
            status_code=404, detail="Endpoint disponible solo en modo dev"
        )


def _require_admin_token(provided: Optional[str]) -> None:
    """Constant-time compare against ``SUSURRA_ADMIN_TOKEN``.

    Empty configured token = endpoint disabled (403 for every caller).
    This is intentional: a missing env var must NEVER turn into a
    permissive default. The founder has to set the secret explicitly."""
    expected = os.getenv("SUSURRA_ADMIN_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=403, detail="admin_token_not_configured")
    if not provided or not _secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="forbidden")


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


@router.post(
    "/api/admin/users",
    response_model=CreateUserResponse,
    status_code=201,
)
async def create_user(
    body: CreateUserRequest,
    x_admin_token: Optional[str] = Header(default=None, alias="X-Admin-Token"),
    use_case: AdminCreateUserUseCase = Depends(get_admin_create_user_use_case),
) -> CreateUserResponse:
    """Provision a user with email + bcrypt password (Phase 2).

    Auth: ``X-Admin-Token: <SUSURRA_ADMIN_TOKEN>`` shared secret.
    Body validates ``password >= 12 chars`` and ``email`` (RFC) at the
    Pydantic layer so the use case can stay free of input plumbing."""
    _require_admin_token(x_admin_token)
    try:
        user = use_case.execute(
            email=str(body.email),
            password=body.password,
            is_admin=body.is_admin,
            name=body.name,
        )
    except ConflictError as e:
        raise HTTPException(status_code=409, detail="user_already_exists") from e
    return CreateUserResponse(
        id=user.id, email=user.email, is_admin=user.is_admin
    )


# ---------------------------------------------------------------------------
# Admin Invitations — founder daily workflow (cookie/JWT auth, not X-Admin-Token)
# ---------------------------------------------------------------------------
#
# Gated by ``user.is_admin`` resolved from the standard cookie/Bearer auth
# stack (see ``get_current_user``). We deliberately AVOID layering the
# X-Admin-Token shared secret on top: the founder is logged in to the web
# app like any other user and the admin flag on their row IS the security
# boundary. The CLI bootstrap path (POST /api/admin/users) still uses the
# shared secret because it pre-dates the existence of admin users.


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="admin_only")


@router.post(
    "/api/admin/invitations",
    response_model=InviteBetaUserResponse,
    status_code=201,
)
async def invite_beta_user(
    body: InviteBetaUserRequest,
    user: User = Depends(get_current_user),
    use_case: InviteBetaUserUseCase = Depends(get_invite_beta_user_use_case),
) -> InviteBetaUserResponse:
    """Provision a beta user + email them their credentials.

    Email delivery is best-effort — if Resend is down the user is still
    created and the invitation row is persisted with ``email_sent=False``
    so the founder can re-send manually from the UI."""
    _require_admin(user)
    try:
        result = await use_case.execute(
            email=str(body.email),
            is_admin=body.is_admin,
            invited_by_user_id=user.id,
        )
    except ConflictError as e:
        raise HTTPException(status_code=409, detail="user_already_exists") from e
    return InviteBetaUserResponse(
        invitation_id=result.invitation_id,
        user_id=result.user_id,
        email=result.email,
        email_sent=result.email_sent,
    )


@router.get(
    "/api/admin/invitations",
    response_model=list[InvitationSummary],
)
async def list_invitations(
    user: User = Depends(get_current_user),
    repo: BetaInvitationsRepository = Depends(get_beta_invitations_repository),
) -> list[InvitationSummary]:
    """List founder-issued invitations (newest-first, capped at 100).

    ``has_logged_in`` is computed by JOIN-ing in-memory against the
    refresh-tokens table — one extra cheap query per page-load, no need
    to instrument the auth hot path."""
    _require_admin(user)
    invitations = repo.list(limit=100)
    user_ids = [inv.user_id for inv in invitations if inv.user_id]
    last_login_map = repo.list_user_last_login_map(user_ids)
    out: list[InvitationSummary] = []
    for inv in invitations:
        last_login_iso = (
            last_login_map.get(inv.user_id) if inv.user_id else None
        )
        last_login_dt = (
            datetime.fromisoformat(last_login_iso) if last_login_iso else None
        )
        out.append(
            InvitationSummary(
                id=inv.id,
                email=inv.email,
                invited_at=inv.invited_at,
                email_sent=inv.email_sent_at is not None,
                has_logged_in=last_login_dt is not None,
                last_login_at=last_login_dt,
                invited_by_user_id=inv.invited_by_user_id,
            )
        )
    return out
