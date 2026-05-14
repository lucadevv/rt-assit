/**
 * GetSubscriptionUseCase — fetch the current user's active subscription.
 *
 * Returns null when the user has no subscription yet (auth middleware
 * auto-starts the 14-day trial on first authenticated request, so the
 * common case post-F1 is `trialing`).
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Subscription } from "@/domain/entities/subscription";

export class GetSubscriptionUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(): Promise<Subscription | null> {
    return this.api.getSubscription();
  }
}
