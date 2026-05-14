"""Repository port for payment methods (B5 — Billing).

PCI compliance: NEVER pass raw card data through this port. Only LS tokens +
display metadata."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.payment_method import PaymentMethod


class PaymentMethodsRepository(ABC):
    @abstractmethod
    def list_for_user(self, user_id: str) -> list[PaymentMethod]:
        ...

    @abstractmethod
    def get_default_for_user(self, user_id: str) -> Optional[PaymentMethod]:
        ...

    @abstractmethod
    def upsert_from_provider(
        self,
        *,
        payment_method_id: str,
        user_id: str,
        lemon_squeezy_payment_method_id: Optional[str],
        type: str,
        brand: Optional[str],
        last_four: Optional[str],
        exp_month: Optional[int],
        exp_year: Optional[int],
        is_default: bool,
    ) -> PaymentMethod:
        ...
