"""GetSubscriptionUseCase — current subscription for a user (or None)."""
from __future__ import annotations

from typing import Optional

from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.domain.entities.subscription import Subscription


class GetSubscriptionUseCase:
    def __init__(self, subscriptions_repo: SubscriptionsRepository) -> None:
        self.subscriptions = subscriptions_repo

    def execute(self, *, user_id: str) -> Optional[Subscription]:
        return self.subscriptions.get_active_for_user(user_id)
