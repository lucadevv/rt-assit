/**
 * ListPaymentMethodsUseCase — fetch saved payment methods.
 *
 * In dev mode the backend returns []. PCI: only display metadata is
 * exposed (brand + last 4 digits + expiration), never PAN/CVV.
 */

import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { PaymentMethod } from "@/domain/entities/payment-method";

export class ListPaymentMethodsUseCase {
  constructor(private readonly api: BillingApiPort) {}

  execute(): Promise<PaymentMethod[]> {
    return this.api.listPaymentMethods();
  }
}
