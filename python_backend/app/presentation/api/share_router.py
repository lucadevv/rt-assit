"""Share Links HTTP endpoints (B7 — Premium share links).

Auth tiers:
- Public:        GET /api/public/share/{link_id}        (rate-limited only)
- Authenticated: POST/GET /api/sessions/{id}/share, DELETE /api/share/{id}

Tier gating: Pro+ users can create share links (Pro capped at 10/period via
CheckTierLimitsUseCase, Premium unlimited). Free tier gets HTTP 402 with a
structured upgrade detail.

HTTP status semantics:
- 200 — created / fetched / revoked
- 400 — invalid permissions value or expires_in_hours
- 402 — tier-gated (free tier OR Pro tier exceeded period quota)
- 404 — session not found / link not found / link not authorised
- 410 — link revoked OR link expired (Gone, by design)"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.application.use_cases.create_share_link import (
    CreateShareLinkUseCase,
)
from app.application.use_cases.get_shared_session_public import (
    GetSharedSessionPublicUseCase,
)
from app.application.use_cases.list_share_links_for_session import (
    ListShareLinksForSessionUseCase,
)
from app.application.use_cases.revoke_share_link import (
    RevokeShareLinkUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import (
    GoneError,
    NotFoundError,
    UpgradeRequiredError,
    ValidationError,
)
from app.presentation.api.billing_router import upgrade_required_to_http
from app.presentation.api.schemas import (
    CreateShareLinkRequest,
    RevokeShareLinkResponse,
    SharedSessionResponse,
    ShareLinkResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_create_share_link_use_case,
    get_list_share_links_for_session_use_case,
    get_revoke_share_link_use_case,
    get_shared_session_public_use_case,
)


logger = logging.getLogger(__name__)


router = APIRouter()


# ---------------------------------------------------------------------------
# Authenticated endpoints (owner-scoped)
# ---------------------------------------------------------------------------


@router.post(
    "/api/sessions/{session_id}/share", response_model=ShareLinkResponse
)
async def create_share_link(
    session_id: str,
    request: CreateShareLinkRequest,
    user: User = Depends(get_current_user),
    use_case: CreateShareLinkUseCase = Depends(
        get_create_share_link_use_case
    ),
) -> ShareLinkResponse:
    """Generate a public share link for a session. Pro+ only.

    Errors:
    - 400 Bad Request    → invalid permissions or expires_in_hours
    - 402 Payment Required → user is on Free tier OR Pro tier quota exceeded
    - 404 Not Found     → session does not belong to the user
    """
    try:
        link = use_case.execute(
            session_id=session_id,
            user_id=user.id,
            permissions=request.permissions,
            expires_in_hours=request.expires_in_hours,
        )
    except UpgradeRequiredError as e:
        raise upgrade_required_to_http(e) from e
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return ShareLinkResponse.from_domain(link)


@router.get(
    "/api/sessions/{session_id}/share",
    response_model=list[ShareLinkResponse],
)
async def list_share_links_for_session(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: ListShareLinksForSessionUseCase = Depends(
        get_list_share_links_for_session_use_case
    ),
) -> list[ShareLinkResponse]:
    """List all share links for a session (owner only). Includes both
    active and revoked links so the owner can see history."""
    try:
        links = use_case.execute(session_id=session_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return [ShareLinkResponse.from_domain(link) for link in links]


@router.delete(
    "/api/share/{link_id}", response_model=RevokeShareLinkResponse
)
async def revoke_share_link(
    link_id: str,
    user: User = Depends(get_current_user),
    use_case: RevokeShareLinkUseCase = Depends(
        get_revoke_share_link_use_case
    ),
) -> RevokeShareLinkResponse:
    """Revoke a share link (soft-delete via revoked_at).

    404 is returned both when the link doesn't exist AND when the link
    belongs to another tenant — never leak existence to non-owners."""
    revoked = use_case.execute(link_id=link_id, user_id=user.id)
    if not revoked:
        raise HTTPException(
            status_code=404,
            detail="Link no encontrado o no autorizado",
        )
    return RevokeShareLinkResponse(revoked=True)


# ---------------------------------------------------------------------------
# Public endpoint — NO AUTH (the link id IS the credential)
# ---------------------------------------------------------------------------


@router.get(
    "/api/public/share/{link_id}", response_model=SharedSessionResponse
)
async def get_shared_session_public(
    link_id: str,
    use_case: GetSharedSessionPublicUseCase = Depends(
        get_shared_session_public_use_case
    ),
) -> SharedSessionResponse:
    """Public session view — NO authentication required.

    Errors:
    - 404 Not Found → link id never existed OR session was deleted
    - 410 Gone     → link is revoked OR expired

    Side effect: increments ``view_count`` atomically on each successful
    access (best-effort; never blocks)."""
    try:
        result = await use_case.execute(link_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except GoneError as e:
        raise HTTPException(status_code=410, detail=str(e)) from e

    return SharedSessionResponse.from_dict(result)
