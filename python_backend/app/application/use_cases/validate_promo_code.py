"""ValidatePromoCodeUseCase (FR-105) — return validation result.

Does NOT redeem the code (that happens server-side on actual checkout). Used
by the frontend to surface a "code valid / discount X" preview before checkout."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.application.ports.promo_codes_repository import PromoCodesRepository
from app.application.services.billing_periods import utcnow
from app.domain.entities.promo_code import PromoCode


@dataclass
class PromoValidation:
    valid: bool
    reason: Optional[str]
    promo_code: Optional[PromoCode]


class ValidatePromoCodeUseCase:
    def __init__(self, repo: PromoCodesRepository) -> None:
        self.repo = repo

    def execute(
        self, *, user_id: str, code: str, plan_id: Optional[str] = None
    ) -> PromoValidation:
        if not code or not code.strip():
            return PromoValidation(False, "código vacío", None)

        promo = self.repo.get_by_code(code.strip())
        if promo is None:
            return PromoValidation(False, "código no encontrado", None)
        if not promo.is_active:
            return PromoValidation(False, "código inactivo", None)

        now = utcnow()
        if promo.valid_from and now < promo.valid_from:
            return PromoValidation(False, "código aún no válido", None)
        if promo.valid_until and now > promo.valid_until:
            return PromoValidation(False, "código expirado", None)

        if (
            promo.max_uses is not None
            and promo.times_redeemed >= promo.max_uses
        ):
            return PromoValidation(False, "código sin usos disponibles", None)

        if promo.max_uses_per_user > 0:
            used = self.repo.count_uses_by_user(promo.id, user_id)
            if used >= promo.max_uses_per_user:
                return PromoValidation(False, "ya usaste este código", None)

        if (
            plan_id is not None
            and promo.applicable_plans
            and plan_id not in promo.applicable_plans
        ):
            return PromoValidation(
                False, "código no aplicable a este plan", None
            )

        return PromoValidation(True, None, promo)
