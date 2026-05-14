/**
 * GetCurrentUsageUseCase — fetch the current month's usage record.
 *
 * Backend always returns a record (zero-initialised on first read of a
 * new period via `INSERT OR IGNORE`).
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Usage } from "@/domain/entities/usage";

export class GetCurrentUsageUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(): Promise<Usage> {
    return this.api.getCurrentUsage();
  }
}
