"""POST /api/meetings/meet/create — create a Google Meet meeting (Sprint 1)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.application.services.meet_provider import (
    MeetProvider,
    NotConnectedError,
    TokenRefreshError,
)
from app.domain.entities.user import User
from app.infrastructure.meet.google_meet_client import MeetApiError
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import get_meet_provider


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
