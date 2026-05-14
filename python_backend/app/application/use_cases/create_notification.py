"""CreateNotificationUseCase (B8)."""
from __future__ import annotations

from typing import Any, Optional

from app.application.ports.notifications_repository import (
    NotificationsRepository,
)
from app.domain.entities.notification import (
    Notification,
    NotificationChannel,
    NotificationType,
    VALID_NOTIFICATION_CHANNELS,
    VALID_NOTIFICATION_TYPES,
)
from app.domain.exceptions import ValidationError


class CreateNotificationUseCase:
    def __init__(self, repo: NotificationsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        user_id: str,
        type: str,
        channel: str,
        title: str,
        body: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Notification:
        if type not in VALID_NOTIFICATION_TYPES:
            raise ValidationError(f"Tipo de notificación inválido: {type}")
        if channel not in VALID_NOTIFICATION_CHANNELS:
            raise ValidationError(f"Canal de notificación inválido: {channel}")
        if not title.strip():
            raise ValidationError("El título de la notificación no puede estar vacío")
        if not body.strip():
            raise ValidationError("El cuerpo de la notificación no puede estar vacío")

        notification = Notification(
            id=0,
            user_id=user_id,
            type=type,  # type: ignore[arg-type]
            channel=channel,  # type: ignore[arg-type]
            title=title,
            body=body,
            metadata=metadata or {},
        )
        return self.repo.create(notification)
