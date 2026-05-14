/**
 * CreateCheckoutUseCase — create a Lemon Squeezy (or dev-mock) checkout
 * URL for the given plan.
 *
 * The hook layer is responsible for redirecting to `result.checkoutUrl`.
 * In dev mode the URL points back to /dev/billing/mock-checkout which
 * simulates a successful purchase server-side.
 */

import type {
  BillingApiPort,
  CheckoutResult,
} from "@/application/ports/billing-api.port";

export interface CreateCheckoutInput {
  planId: string;
  promoCode?: string | null;
}

export class CreateCheckoutUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(input: CreateCheckoutInput): Promise<CheckoutResult> {
    return this.api.createCheckout(input.planId, input.promoCode ?? null);
  }
}
