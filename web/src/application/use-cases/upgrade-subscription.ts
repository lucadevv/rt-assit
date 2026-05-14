/**
 * UpgradeSubscriptionUseCase — upgrade to a higher-tier plan.
 *
 * Backend validates the target plan is strictly higher than the current
 * plan (ValidationError if not). The presentation hook surfaces backend
 * errors as Spanish strings.
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Subscription } from "@/domain/entities/subscription";

export class UpgradeSubscriptionUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(planId: string): Promise<Subscription> {
    return this.api.upgrade(planId);
  }
}
