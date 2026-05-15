/**
 * ReactivateSubscriptionUseCase — clear cancel_at_period_end on a
 * subscription that was scheduled for cancellation.
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Subscription } from "@/domain/entities/subscription";

export class ReactivateSubscriptionUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(): Promise<Subscription> {
    return this.api.reactivate();
  }
}
