"""ListNotificationsUseCase (B8)."""
from __future__ import annotations

from app.application.ports.notifications_repository import (
    NotificationsRepository,
)
from app.domain.entities.notification import Notification


class ListNotificationsUseCase:
    def __init__(self, repo: NotificationsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        # Clamp pagination defensively.
        if limit < 1:
            limit = 1
        if limit > 200:
            limit = 200
        if offset < 0:
            offset = 0
        return self.repo.list_for_user(
            user_id, unread_only=unread_only, limit=limit, offset=offset
        )


class CountUnreadNotificationsUseCase:
    def __init__(self, repo: NotificationsRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str) -> int:
        return self.repo.count_unread(user_id)
