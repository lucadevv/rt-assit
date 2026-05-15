/**
 * BillingApiPort — application contract for the 14 billing endpoints
 * exposed by python_backend (B5).
 *
 * Use cases depend on this interface, not on the concrete HTTP adapter,
 * so they remain mockable for unit tests and free of `fetch` details.
 *
 * Money throughout the contract is in integer cents — presentation
 * formats as currency (Intl.NumberFormat) at the component boundary.
 *
 * Backend reference: python_backend/app/presentation/api/billing_router.py
 */

import type { Plan } from "@/domain/entities/plan";
import type { Subscription } from "@/domain/entities/subscription";
import type { PaymentMethod } from "@/domain/entities/payment-method";
import type { Invoice } from "@/domain/entities/invoice";
import type { Usage } from "@/domain/entities/usage";

export interface CheckoutResult {
  checkoutUrl: string;
}

export interface PortalResult {
  /** May be null in dev mode (DevBillingProvider returns no portal). */
  portalUrl: string | null;
}

export type PromoDiscountType = "percentage" | "fixed_amount" | "first_month_free";

export interface PromoValidateResult {
  valid: boolean;
  /** Spanish reason returned by the backend. */
  reason: string | null;
  code: string | null;
  discountType: PromoDiscountType | null;
  /** For percentage = 0..100; for fixed_amount = cents. */
  discountValue: number | null;
}

export type BillingCycleParam = "monthly" | "yearly";

export interface BillingApiPort {
  /** Public — no auth. Returns the active plan catalog (sorted). */
  listPlans(): Promise<Plan[]>;

  /** Authenticated — current user's active subscription (null if none). */
  getSubscription(): Promise<Subscription | null>;

  /** Authenticated — returns Lemon Squeezy checkout URL (or dev mock URL). */
  createCheckout(planId: string, promoCode?: string | null): Promise<CheckoutResult>;

  /** Authenticated — upgrade to a higher-tier plan. */
  upgrade(planId: string): Promise<Subscription>;

  /** Authenticated — schedule a downgrade to a lower-tier plan. */
  downgrade(planId: string): Promise<Subscription>;

  /** Authenticated — switch billing cycle for the current plan. */
  changeCycle(to: BillingCycleParam): Promise<Subscription>;

  /** Authenticated — flag cancel_at_period_end=true. */
  cancel(): Promise<Subscription>;

  /** Authenticated — clear cancel_at_period_end. */
  reactivate(): Promise<Subscription>;

  /** Authenticated — start the 14-day trial (idempotent). */
  startTrial(): Promise<Subscription | null>;

  /** Authenticated — list saved payment methods. */
  listPaymentMethods(): Promise<PaymentMethod[]>;

  /** Authenticated — Lemon Squeezy customer portal URL. */
  getPortalUrl(): Promise<PortalResult>;

  /** Authenticated — invoices history (paginated). */
  listInvoices(limit?: number, offset?: number): Promise<Invoice[]>;

  /** Authenticated — current month's usage record. */
  getCurrentUsage(): Promise<Usage>;

  /** Authenticated — last 12 months of usage records. */
  getUsageHistory(): Promise<Usage[]>;

  /** Authenticated — validate a promo code (does NOT apply it). */
  validatePromo(code: string, planId?: string | null): Promise<PromoValidateResult>;
}
