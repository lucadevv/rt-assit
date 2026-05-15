/**
 * ListInvoicesUseCase — fetch the user's invoices (paginated).
 *
 * Default pagination matches the backend default (limit=20, offset=0).
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { Invoice } from "@/domain/entities/invoice";

export interface ListInvoicesInput {
  limit?: number;
  offset?: number;
}

export class ListInvoicesUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(input?: ListInvoicesInput): Promise<Invoice[]> {
    return this.api.listInvoices(input?.limit, input?.offset);
  }
}
