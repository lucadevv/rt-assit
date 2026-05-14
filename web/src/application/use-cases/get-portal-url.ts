/**
 * GetPortalUrlUseCase — fetch the Lemon Squeezy customer portal URL.
 *
 * The hook redirects the user to the portal where they can manage cards,
 * billing address, etc. In dev mode the backend may return null
 * (DevBillingProvider has no portal); the hook should surface a tooltip.
 */

import type {
  BillingApiPort,
  PortalResult,
} from "@/application/ports/billing-api.port";

export class GetPortalUrlUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(): Promise<PortalResult> {
    return this.api.getPortalUrl();
  }
}
