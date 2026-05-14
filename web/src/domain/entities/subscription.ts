/**
 * Subscription domain entity — TypeScript mirror of the backend
 * `Subscription` entity.
 *
 * Backend contract (python_backend/app/domain/entities/subscription.py
 * exposed via GET /api/billing/subscription as `SubscriptionResponse`):
 *
 *   {
 *     id: string,
 *     user_id: string,
 *     plan_id: string,                       // FK -> Plan.id
 *     status: "incomplete" | "trialing" | "active" | "past_due"
 *           | "canceled" | "expired" | "paused",
 *     lemon_squeezy_subscription_id: string | null,
 *     current_period_start: string | null,   // ISO 8601 UTC
 *     current_period_end: string | null,
 *     trial_start: string | null,
 *     trial_end: string | null,
 *     cancel_at_period_end: boolean,
 *     canceled_at: string | null,
 *     payment_failed_at: string | null,
 *     grace_period_end: string | null,
 *     pending_plan_id: string | null,
 *     promo_code_applied: string | null,
 *     discount_cents: integer
 *   }
 */

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused";

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  lemonSqueezySubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  paymentFailedAt: string | null;
  gracePeriodEnd: string | null;
  pendingPlanId: string | null;
  promoCodeApplied: string | null;
  discountCents: number;
}
