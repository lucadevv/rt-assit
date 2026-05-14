/**
 * PaymentMethod domain entity — TypeScript mirror of the backend
 * `PaymentMethod` entity.
 *
 * Backend contract (GET /api/billing/payment-methods as
 * `PaymentMethodResponse`):
 *
 *   {
 *     id: string,
 *     type: "card" | "paypal",
 *     brand: string | null,         // visa, mastercard, etc.
 *     last_four: string | null,
 *     exp_month: number | null,
 *     exp_year: number | null,
 *     is_default: boolean,
 *     is_active: boolean
 *   }
 *
 * NOTE: PCI compliance — the backend NEVER stores PAN/CVV. Only
 * Lemon Squeezy tokens + display metadata.
 */

export type PaymentMethodType = "card" | "paypal";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  brand: string | null;
  lastFour: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  isActive: boolean;
}
