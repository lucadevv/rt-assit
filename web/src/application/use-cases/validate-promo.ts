/**
 * ValidatePromoUseCase — validate a promo code without applying it.
 *
 * Backend returns `{valid, reason, code, discountType, discountValue}`.
 * `reason` is a human-readable Spanish string the UI surfaces directly.
 */

import type {
  BillingApiPort,
  PromoValidateResult,
} from "@/application/ports/billing-api.port";

export interface ValidatePromoInput {
  code: string;
  planId?: string | null;
}

export class ValidatePromoUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(input: ValidatePromoInput): Promise<PromoValidateResult> {
    return this.api.validatePromo(input.code, input.planId ?? null);
  }
}
