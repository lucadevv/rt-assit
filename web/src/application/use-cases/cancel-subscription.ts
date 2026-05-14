/**
 * CancelSubscriptionUseCase — schedule cancellation at period end.
 *
 * Backend semantics: sets `cancel_at_period_end=true`. The user keeps
 * access until `current_period_end`; afterwards the subscription
 * transitions to `expired`.
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Subscription } from "@/domain/entities/subscription";

export class CancelSubscriptionUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(): Promise<Subscription> {
    return this.api.cancel();
  }
}
