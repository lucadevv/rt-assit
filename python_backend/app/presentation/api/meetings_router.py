"""Meeting REST endpoints.

Sprint 1: POST /api/meetings/meet/create (create a Google Meet space).
Sprint 1.5: GET /api/meetings (list user's meetings) +
DELETE /api/meetings/{id} (remove an owned meeting).

The list / delete endpoints are provider-agnostic — they hit the
``MeetingsRepository`` directly without going through the per-provider
service. That keeps them cheap (no OAuth token exchange) and ready for
Sprints 2/3 (Teams, Zoom) without code changes."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.application.ports.meetings_repository import MeetingsRepository
from app.application.services.meet_provider import (
    MeetProvider,
    NotConnectedError,
    TokenRefreshError,
)
from app.domain.entities.user import User
from app.infrastructure.meet.google_meet_client import MeetApiError
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import get_meet_provider, get_meetings_repository


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/meetings", tags=["meetings"])


class CreateMeetRequest(BaseModel):
    title: str | None = None


class CreateMeetResponse(BaseModel):
    id: str
    provider: str
    join_url: str
    title: str | None
    created_at: int


class MeetingResponse(BaseModel):
    """Provider-agnostic meeting response.

    Same shape as ``CreateMeetResponse`` plus ``provider_meeting_id`` so
    the frontend has the full DB row (used to debug / contact support /
    cross-reference with the provider's console)."""

    id: str
    provider: str
    join_url: str
    title: str | None
    created_at: int
    provider_meeting_id: str


class DeleteMeetingResponse(BaseModel):
    deleted: bool


@router.post("/meet/create", response_model=CreateMeetResponse)
async def create_meet_meeting(
    body: CreateMeetRequest,
    user: User = Depends(get_current_user),
    provider: MeetProvider = Depends(get_meet_provider),
) -> CreateMeetResponse:
    """Create a Google Meet space owned by the authenticated user.

    Returns 412 if the user hasn't connected Google yet (frontend should
    push them to ``Configuración → Reuniones``). Returns 401 if the
    refresh token can't be exchanged (user must reconnect). Returns 502
    if Meet API itself failed."""
    try:
        meeting = await provider.create_meeting(user_id=user.id, title=body.title)
    except NotConnectedError:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="google_not_connected",
        )
    except TokenRefreshError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token_refresh_failed",
        )
    except MeetApiError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"meet_api_error: {e.status}",
        )

    return CreateMeetResponse(
        id=meeting.id,
        provider=meeting.provider,
        join_url=meeting.join_url,
        title=meeting.title,
        created_at=meeting.created_at,
    )


@router.get("", response_model=list[MeetingResponse])
async def list_my_meetings(
    user: User = Depends(get_current_user),
    repo: MeetingsRepository = Depends(get_meetings_repository),
) -> list[MeetingResponse]:
    """List the authenticated user's meetings (Sprint 1.5).

    Provider-agnostic — returns every meeting (Meet / Teams / Zoom)
    the user owns, ordered newest-first. Capped at 50 by the repo."""
    meetings = repo.list_for_user(user_id=user.id, limit=50)
    return [
        MeetingResponse(
            id=m.id,
            provider=m.provider,
            join_url=m.join_url,
            title=m.title,
            created_at=m.created_at,
            provider_meeting_id=m.provider_meeting_id,
        )
        for m in meetings
    ]


@router.delete("/{meeting_id}", response_model=DeleteMeetingResponse)
async def delete_meeting(
    meeting_id: str,
    user: User = Depends(get_current_user),
    repo: MeetingsRepository = Depends(get_meetings_repository),
) -> DeleteMeetingResponse:
    """Remove an owned meeting (Sprint 1.5).

    Returns 404 if the meeting doesn't exist OR belongs to a different
    user — we don't disclose existence across tenants. Does NOT delete
    the meeting on the provider side (a Meet space lingers until Google
    GCs it). The /api/sessions row that referenced it (if any) keeps its
    dangling ``meeting_id`` — GET /api/sessions/{id} silently degrades to
    ``meeting_url=None`` since the lookup fails."""
    existing = repo.get(meeting_id)
    if existing is None or existing.user_id != user.id:
        raise HTTPException(status_code=404, detail="meeting_not_found")
    repo.delete(meeting_id)
    return DeleteMeetingResponse(deleted=True)
