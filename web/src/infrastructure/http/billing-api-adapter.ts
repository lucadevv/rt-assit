/**
 * BillingApiAdapter — concrete `BillingApiPort` implementation.
 *
 * Backend reference: python_backend/app/presentation/api/billing_router.py
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping for every billing entity.
 *  - JSON shape validation (we trust the backend schemas but harden the
 *    boundary so unknown enum values don't leak as generic strings into
 *    the domain — they fall back to safe defaults).
 *  - Pure adapter — NO presentation state, NO storing of results, NO
 *    redirect logic (those live in the hook layer).
 *
 * Money is stored as integer cents end-to-end. Times are ISO 8601 UTC
 * strings; the presentation formats them via toLocaleDateString.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  BillingApiPort,
  BillingCycleParam,
  CheckoutResult,
  PortalResult,
  PromoDiscountType,
  PromoValidateResult,
} from "@/application/ports/billing-api.port";
import type {
  BillingCycle,
  Plan,
  PlanCode,
  PlanLimits,
} from "@/domain/entities/plan";
import type {
  Subscription,
  SubscriptionStatus,
} from "@/domain/entities/subscription";
import type {
  PaymentMethod,
  PaymentMethodType,
} from "@/domain/entities/payment-method";
import type { Invoice, InvoiceStatus } from "@/domain/entities/invoice";
import type { Usage } from "@/domain/entities/usage";

// ---------------------------------------------------------------------------
// Raw response shapes (backend snake_case)
// ---------------------------------------------------------------------------

interface PlanLimitsRaw {
  max_session_duration_minutes?: number | null;
  max_minutes_per_month?: number | null;
  max_docs?: number | null;
  max_recordings?: number | null;
  max_storage_gb?: number;
  max_share_links?: number | null;
  max_custom_scenarios?: number | null;
  diarization_enabled?: boolean;
  voice_fingerprinting_enabled?: boolean;
  tweaks_layouts_unlocked?: string[];
  tweaks_hint_styles_unlocked?: string[];
  tweaks_transcript_styles_unlocked?: string[];
  byok_enabled?: boolean;
  priority_support?: boolean;
  export_formats?: string[];
  stealth_mode?: boolean;
}

interface PlanRaw {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  limits: PlanLimitsRaw;
  is_active: boolean;
  is_legacy: boolean;
  sort_order: number;
}

interface SubscriptionRaw {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  lemon_squeezy_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  payment_failed_at: string | null;
  grace_period_end: string | null;
  pending_plan_id: string | null;
  promo_code_applied: string | null;
  discount_cents: number;
}

interface PaymentMethodRaw {
  id: string;
  type: string;
  brand: string | null;
  last_four: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  is_active: boolean;
}

interface InvoiceRaw {
  id: string;
  subscription_id: string | null;
  invoice_number: string | null;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
  paid_at: string | null;
  invoice_pdf_url: string | null;
}

interface UsageRaw {
  user_id: string;
  period_start: string;
  period_end: string;
  minutes_used: number;
  sessions_count: number;
  sessions_completed: number;
  docs_count: number;
  storage_bytes_used: number;
  share_links_created: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  stt_audio_seconds: number;
  cost_cents: number;
  limit_hits: Record<string, unknown>;
}

interface CheckoutResponseRaw {
  checkout_url: string;
}

interface PortalResponseRaw {
  url: string | null;
}

interface PromoValidationRaw {
  valid: boolean;
  reason: string | null;
  code: string | null;
  discount_type: string | null;
  discount_value: number | null;
}

// ---------------------------------------------------------------------------
// Defensive enum coercion
// ---------------------------------------------------------------------------

const VALID_PLAN_CODES: readonly PlanCode[] = [
  "free",
  "pro",
  "premium",
  "byok",
];
const VALID_BILLING_CYCLES: readonly BillingCycle[] = [
  "free",
  "monthly",
  "yearly",
  "lifetime",
];
const VALID_SUB_STATUS: readonly SubscriptionStatus[] = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
  "paused",
];
const VALID_INVOICE_STATUS: readonly InvoiceStatus[] = [
  "draft",
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
];
const VALID_PAYMENT_TYPES: readonly PaymentMethodType[] = ["card", "paypal"];
const VALID_PROMO_DISCOUNT: readonly PromoDiscountType[] = [
  "percentage",
  "fixed_amount",
  "first_month_free",
];

function asPlanCode(raw: string): PlanCode {
  return (VALID_PLAN_CODES as readonly string[]).includes(raw)
    ? (raw as PlanCode)
    : "free";
}
function asBillingCycle(raw: string): BillingCycle {
  return (VALID_BILLING_CYCLES as readonly string[]).includes(raw)
    ? (raw as BillingCycle)
    : "free";
}
function asSubStatus(raw: string): SubscriptionStatus {
  return (VALID_SUB_STATUS as readonly string[]).includes(raw)
    ? (raw as SubscriptionStatus)
    : "incomplete";
}
function asInvoiceStatus(raw: string): InvoiceStatus {
  return (VALID_INVOICE_STATUS as readonly string[]).includes(raw)
    ? (raw as InvoiceStatus)
    : "pending";
}
function asPaymentType(raw: string): PaymentMethodType {
  return (VALID_PAYMENT_TYPES as readonly string[]).includes(raw)
    ? (raw as PaymentMethodType)
    : "card";
}
function asPromoDiscount(raw: string | null): PromoDiscountType | null {
  if (raw === null) return null;
  return (VALID_PROMO_DISCOUNT as readonly string[]).includes(raw)
    ? (raw as PromoDiscountType)
    : null;
}

// ---------------------------------------------------------------------------
// Mappers (raw -> domain)
// ---------------------------------------------------------------------------

function mapPlanLimits(raw: PlanLimitsRaw | undefined): PlanLimits {
  const r = raw ?? {};
  return {
    max_session_duration_minutes: r.max_session_duration_minutes ?? null,
    max_minutes_per_month: r.max_minutes_per_month ?? null,
    max_docs: r.max_docs ?? null,
    max_recordings: r.max_recordings ?? null,
    max_storage_gb: r.max_storage_gb ?? 0,
    max_share_links: r.max_share_links ?? null,
    max_custom_scenarios: r.max_custom_scenarios ?? null,
    diarization_enabled: r.diarization_enabled ?? false,
    voice_fingerprinting_enabled: r.voice_fingerprinting_enabled ?? false,
    tweaks_layouts_unlocked: r.tweaks_layouts_unlocked ?? [],
    tweaks_hint_styles_unlocked: r.tweaks_hint_styles_unlocked ?? [],
    tweaks_transcript_styles_unlocked: r.tweaks_transcript_styles_unlocked ?? [],
    byok_enabled: r.byok_enabled ?? false,
    priority_support: r.priority_support ?? false,
    export_formats: r.export_formats ?? [],
    stealth_mode: r.stealth_mode ?? false,
  };
}

function mapPlan(raw: PlanRaw): Plan {
  return {
    id: raw.id,
    code: asPlanCode(raw.code),
    name: raw.name,
    description: raw.description,
    priceCents: raw.price_cents,
    currency: raw.currency,
    billingCycle: asBillingCycle(raw.billing_cycle),
    limits: mapPlanLimits(raw.limits),
    isActive: raw.is_active,
    isLegacy: raw.is_legacy,
    sortOrder: raw.sort_order,
  };
}

function mapSubscription(raw: SubscriptionRaw): Subscription {
  return {
    id: raw.id,
    userId: raw.user_id,
    planId: raw.plan_id,
    status: asSubStatus(raw.status),
    lemonSqueezySubscriptionId: raw.lemon_squeezy_subscription_id,
    currentPeriodStart: raw.current_period_start,
    currentPeriodEnd: raw.current_period_end,
    trialStart: raw.trial_start,
    trialEnd: raw.trial_end,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    canceledAt: raw.canceled_at,
    paymentFailedAt: raw.payment_failed_at,
    gracePeriodEnd: raw.grace_period_end,
    pendingPlanId: raw.pending_plan_id,
    promoCodeApplied: raw.promo_code_applied,
    discountCents: raw.discount_cents,
  };
}

function mapPaymentMethod(raw: PaymentMethodRaw): PaymentMethod {
  return {
    id: raw.id,
    type: asPaymentType(raw.type),
    brand: raw.brand,
    lastFour: raw.last_four,
    expMonth: raw.exp_month,
    expYear: raw.exp_year,
    isDefault: raw.is_default,
    isActive: raw.is_active,
  };
}

function mapInvoice(raw: InvoiceRaw): Invoice {
  return {
    id: raw.id,
    subscriptionId: raw.subscription_id,
    invoiceNumber: raw.invoice_number,
    subtotalCents: raw.subtotal_cents,
    discountCents: raw.discount_cents,
    taxCents: raw.tax_cents,
    totalCents: raw.total_cents,
    currency: raw.currency,
    status: asInvoiceStatus(raw.status),
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
    issuedAt: raw.issued_at,
    paidAt: raw.paid_at,
    invoicePdfUrl: raw.invoice_pdf_url,
  };
}

function mapUsage(raw: UsageRaw): Usage {
  return {
    userId: raw.user_id,
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
    minutesUsed: raw.minutes_used,
    sessionsCount: raw.sessions_count,
    sessionsCompleted: raw.sessions_completed,
    docsCount: raw.docs_count,
    storageBytesUsed: raw.storage_bytes_used,
    shareLinksCreated: raw.share_links_created,
    llmInputTokens: raw.llm_input_tokens,
    llmOutputTokens: raw.llm_output_tokens,
    sttAudioSeconds: raw.stt_audio_seconds,
    costCents: raw.cost_cents,
    limitHits: raw.limit_hits ?? {},
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class BillingApiAdapter implements BillingApiPort {
  constructor(private readonly api: ApiClient) {}

  async listPlans(): Promise<Plan[]> {
    const raw = await this.api.get<PlanRaw[]>("/api/plans");
    return raw.map(mapPlan);
  }

  async getSubscription(): Promise<Subscription | null> {
    const raw = await this.api.get<SubscriptionRaw | null>(
      "/api/billing/subscription",
    );
    return raw ? mapSubscription(raw) : null;
  }

  async createCheckout(
    planId: string,
    promoCode?: string | null,
  ): Promise<CheckoutResult> {
    const body: Record<string, unknown> = { plan_id: planId };
    if (promoCode) body["promo_code"] = promoCode;
    const raw = await this.api.post<CheckoutResponseRaw>(
      "/api/billing/checkout",
      body,
    );
    return { checkoutUrl: raw.checkout_url };
  }

  async upgrade(planId: string): Promise<Subscription> {
    const raw = await this.api.post<SubscriptionRaw>("/api/billing/upgrade", {
      plan_id: planId,
    });
    return mapSubscription(raw);
  }

  async downgrade(planId: string): Promise<Subscription> {
    const raw = await this.api.post<SubscriptionRaw>("/api/billing/downgrade", {
      plan_id: planId,
    });
    return mapSubscription(raw);
  }

  async changeCycle(to: BillingCycleParam): Promise<Subscription> {
    const raw = await this.api.post<SubscriptionRaw>(
      "/api/billing/change-cycle",
      { to },
    );
    return mapSubscription(raw);
  }

  async cancel(): Promise<Subscription> {
    const raw = await this.api.post<SubscriptionRaw>("/api/billing/cancel");
    return mapSubscription(raw);
  }

  async reactivate(): Promise<Subscription> {
    const raw = await this.api.post<SubscriptionRaw>(
      "/api/billing/reactivate",
    );
    return mapSubscription(raw);
  }

  async startTrial(): Promise<Subscription | null> {
    const raw = await this.api.post<SubscriptionRaw | null>(
      "/api/billing/start-trial",
    );
    return raw ? mapSubscription(raw) : null;
  }

  async listPaymentMethods(): Promise<PaymentMethod[]> {
    const raw = await this.api.get<PaymentMethodRaw[]>(
      "/api/billing/payment-methods",
    );
    return (raw ?? []).map(mapPaymentMethod);
  }

  async getPortalUrl(): Promise<PortalResult> {
    const raw = await this.api.post<PortalResponseRaw>(
      "/api/billing/payment-methods/portal",
    );
    return { portalUrl: raw.url ?? null };
  }

  async listInvoices(limit = 20, offset = 0): Promise<Invoice[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const raw = await this.api.get<InvoiceRaw[]>(
      `/api/billing/invoices?${params.toString()}`,
    );
    return (raw ?? []).map(mapInvoice);
  }

  async getCurrentUsage(): Promise<Usage> {
    const raw = await this.api.get<UsageRaw>("/api/billing/usage");
    return mapUsage(raw);
  }

  async getUsageHistory(): Promise<Usage[]> {
    const raw = await this.api.get<{ items?: UsageRaw[] }>(
      "/api/billing/usage/history",
    );
    return (raw.items ?? []).map(mapUsage);
  }

  async validatePromo(
    code: string,
    planId?: string | null,
  ): Promise<PromoValidateResult> {
    const body: Record<string, unknown> = { code };
    if (planId) body["plan_id"] = planId;
    const raw = await this.api.post<PromoValidationRaw>(
      "/api/billing/promo/validate",
      body,
    );
    return {
      valid: raw.valid,
      reason: raw.reason,
      code: raw.code,
      discountType: asPromoDiscount(raw.discount_type),
      discountValue: raw.discount_value,
    };
  }
}

export const __testing = {
  mapPlan,
  mapSubscription,
  mapPaymentMethod,
  mapInvoice,
  mapUsage,
  mapPlanLimits,
};
