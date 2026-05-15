/**
 * DowngradeSubscriptionUseCase — schedule a downgrade for the next
 * period.
 *
 * Backend stores the target plan in `pending_plan_id` and switches at
 * period end so the user keeps full access until then.
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Subscription } from "@/domain/entities/subscription";

export class DowngradeSubscriptionUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(planId: string): Promise<Subscription> {
    return this.api.downgrade(planId);
  }
}
