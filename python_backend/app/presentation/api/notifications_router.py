"""Notifications REST endpoints (B8).

Routes:
  GET    /api/notifications                — list user's notifications
  POST   /api/notifications/:id/read       — mark a single notification read
  POST   /api/notifications/read-all       — mark all read
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.application.use_cases.list_notifications import (
    CountUnreadNotificationsUseCase,
    ListNotificationsUseCase,
)
from app.application.use_cases.mark_notification_read import (
    MarkAllNotificationsReadUseCase,
    MarkNotificationReadUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundError
from app.presentation.api.schemas import (
    MarkReadResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_count_unread_notifications_use_case,
    get_list_notifications_use_case,
    get_mark_all_notifications_read_use_case,
    get_mark_notification_read_use_case,
)


router = APIRouter()


@router.get("/api/notifications", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    use_case: ListNotificationsUseCase = Depends(
        get_list_notifications_use_case
    ),
    count_unread: CountUnreadNotificationsUseCase = Depends(
        get_count_unread_notifications_use_case
    ),
) -> NotificationListResponse:
    items = use_case.execute(
        user_id=user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    unread = count_unread.execute(user_id=user.id)
    return NotificationListResponse(
        items=[NotificationResponse.from_domain(n) for n in items],
        unread_count=unread,
    )


@router.post(
    "/api/notifications/{notification_id}/read",
    response_model=MarkReadResponse,
)
async def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    use_case: MarkNotificationReadUseCase = Depends(
        get_mark_notification_read_use_case
    ),
) -> MarkReadResponse:
    try:
        use_case.execute(notification_id=notification_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return MarkReadResponse(marked=1)


@router.post("/api/notifications/read-all", response_model=MarkReadResponse)
async def mark_all_read(
    user: User = Depends(get_current_user),
    use_case: MarkAllNotificationsReadUseCase = Depends(
        get_mark_all_notifications_read_use_case
    ),
) -> MarkReadResponse:
    n = use_case.execute(user_id=user.id)
    return MarkReadResponse(marked=n)
