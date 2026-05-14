"""Repository port for notifications persistence (B8).

Multi-tenant via ``user_id``. Supports listing with read/unread filter
+ mark-read mutations + bulk mark-all."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.notification import Notification


class NotificationsRepository(ABC):
    @abstractmethod
    def create(self, notification: Notification) -> Notification:
        """Insert and return the row with ``id`` + ``created_at`` populated."""
        ...

    @abstractmethod
    def get(self, notification_id: int, user_id: str) -> Optional[Notification]:
        """Return the notification iff it belongs to ``user_id``, else None."""
        ...

    @abstractmethod
    def list_for_user(
        self,
        user_id: str,
        *,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        """Return notifications ordered by ``created_at DESC``."""
        ...

    @abstractmethod
    def count_unread(self, user_id: str) -> int:
        """Cheap count for badge UIs."""
        ...

    @abstractmethod
    def mark_read(self, notification_id: int, user_id: str) -> bool:
        """Return True iff a row was updated (404 detection on caller side)."""
        ...

    @abstractmethod
    def mark_all_read(self, user_id: str) -> int:
        """Return number of rows affected."""
        ...

    @abstractmethod
    def mark_sent(self, notification_id: int) -> None:
        """Stamp ``sent_at`` after dispatch (email channel)."""
        ...
