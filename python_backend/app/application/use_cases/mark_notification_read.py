"""MarkNotificationReadUseCase + MarkAllNotificationsReadUseCase (B8)."""
from __future__ import annotations

from app.application.ports.notifications_repository import (
    NotificationsRepository,
)
from app.domain.exceptions import NotFoundError


class MarkNotificationReadUseCase:
    def __init__(self, repo: NotificationsRepository) -> None:
        self.repo = repo

    def execute(self, *, notification_id: int, user_id: str) -> None:
        ok = self.repo.mark_read(notification_id, user_id)
        if not ok:
            raise NotFoundError("Notificación no encontrada")


class MarkAllNotificationsReadUseCase:
    def __init__(self, repo: NotificationsRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str) -> int:
        return self.repo.mark_all_read(user_id)
