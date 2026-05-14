"""Repository port for promo codes (B5 — Billing)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from app.domain.entities.promo_code import PromoCode, PromoCodeUse


class PromoCodesRepository(ABC):
    @abstractmethod
    def get_by_code(self, code: str) -> Optional[PromoCode]:
        ...

    @abstractmethod
    def count_uses_by_user(self, promo_code_id: str, user_id: str) -> int:
        ...

    @abstractmethod
    def record_use(
        self,
        *,
        promo_code_id: str,
        user_id: str,
        subscription_id: Optional[str],
        redeemed_at: datetime,
    ) -> PromoCodeUse:
        ...

    @abstractmethod
    def increment_redemptions(self, promo_code_id: str) -> None:
        ...
