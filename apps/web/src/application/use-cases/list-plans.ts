/**
 * ListPlansUseCase — fetch the public plan catalog.
 *
 * Thin wrapper around BillingApiPort.listPlans. Public endpoint —
 * works without auth in dev mode. Caller is responsible for sorting/
 * filtering legacy plans when needed.
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Plan } from "@/domain/entities/plan";

export class ListPlansUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(): Promise<Plan[]> {
    return this.api.listPlans();
  }
}
