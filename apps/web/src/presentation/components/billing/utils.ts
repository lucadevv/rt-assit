/**
 * Billing presentation utilities — money/date formatters and tier helpers.
 *
 * Money is stored as integer cents end-to-end (domain + application +
 * adapter). The presentation boundary is the ONLY place we convert to
 * dollars/floats. Keeping the conversion centralised avoids drift
 * between components.
 */

import type { PillVariant } from "@/design-system/primitives";
import type { PlanCode } from "@/domain/entities/plan";
import type { SubscriptionStatus } from "@/domain/entities/subscription";
import type { InvoiceStatus } from "@/domain/entities/invoice";
import type { RequiredTier } from "@/application/use-cases/check-feature-availability";

const ES_LOCALE = "es-419";

/** Formats integer cents as a currency string (e.g. 1200 USD -> "US$ 12,00"). */
export function formatMoneyCents(cents: number, currency = "USD"): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(ES_LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid — render plain number + code
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Formats an ISO 8601 UTC string as a long Spanish date — "15 de mayo de 2026". */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(ES_LOCALE, { dateStyle: "long" });
  } catch {
    return "—";
  }
}

/** Formats an ISO 8601 UTC string as a short Spanish date — "15/05/2026". */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(ES_LOCALE, { dateStyle: "short" });
  } catch {
    return "—";
  }
}

/** Brand color mapping for plan codes (matches Susurra visual brief). */
export function planPillVariant(code: PlanCode): PillVariant {
  switch (code) {
    case "free":
      return "ghost";
    case "pro":
      return "lime";
    case "premium":
      return "lavender";
    case "byok":
      return "cyan";
    default:
      return "ghost";
  }
}

export function tierPillVariant(tier: RequiredTier): PillVariant {
  switch (tier) {
    case "pro":
      return "lime";
    case "premium":
      return "lavender";
    case "byok":
      return "cyan";
  }
}

export interface SubStatusDisplay {
  label: string;
  variant: PillVariant;
}

export function subscriptionStatusDisplay(
  status: SubscriptionStatus,
  cancelAtPeriodEnd: boolean,
): SubStatusDisplay {
  if (cancelAtPeriodEnd && (status === "active" || status === "trialing")) {
    return { label: "Cancelando", variant: "amber" };
  }
  switch (status) {
    case "trialing":
      return { label: "Trial", variant: "lavender" };
    case "active":
      return { label: "Activa", variant: "lime" };
    case "past_due":
      return { label: "Pago pendiente", variant: "amber" };
    case "canceled":
      return { label: "Cancelada", variant: "ghost" };
    case "expired":
      return { label: "Vencida", variant: "ghost" };
    case "paused":
      return { label: "Pausada", variant: "ghost" };
    case "incomplete":
      return { label: "Incompleta", variant: "ghost" };
    default:
      return { label: status, variant: "ghost" };
  }
}

export interface InvoiceStatusDisplay {
  label: string;
  variant: PillVariant;
}

export function invoiceStatusDisplay(status: InvoiceStatus): InvoiceStatusDisplay {
  switch (status) {
    case "paid":
      return { label: "Pagada", variant: "lime" };
    case "pending":
      return { label: "Pendiente", variant: "amber" };
    case "failed":
      return { label: "Fallida", variant: "amber" };
    case "refunded":
      return { label: "Reembolsada", variant: "ghost" };
    case "partially_refunded":
      return { label: "Reembolso parcial", variant: "ghost" };
    case "draft":
      return { label: "Borrador", variant: "ghost" };
    default:
      return { label: status, variant: "ghost" };
  }
}

/**
 * Usage progress color — lime for healthy, amber 50-80%, red >80%.
 * Returns CSS color tokens so the bar fill stays in the design system.
 */
export interface UsageBarColors {
  fill: string;
  background: string;
}

export function usageColors(percent: number): UsageBarColors {
  if (percent < 50) {
    return {
      fill: "var(--color-lime)",
      background: "var(--color-bg-soft)",
    };
  }
  if (percent < 80) {
    return {
      fill: "var(--color-amber)",
      background: "var(--color-bg-soft)",
    };
  }
  return {
    fill: "var(--color-danger)",
    background: "var(--color-bg-soft)",
  };
}

/** Tier rank for upgrade/downgrade decisions. Higher = more access. */
export const TIER_RANK: Record<PlanCode, number> = {
  free: 0,
  byok: 1,
  pro: 2,
  premium: 3,
};

/** Pretty Spanish label for the user's current tier. */
export function tierName(tier: PlanCode | RequiredTier): string {
  switch (tier) {
    case "free":
      return "Free";
    case "pro":
      return "Pro";
    case "premium":
      return "Premium";
    case "byok":
      return "BYOK";
  }
}
