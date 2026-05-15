"use client";

/**
 * Billing (/app/billing) — F7 implementation.
 *
 * Composition (top → bottom):
 *   1. Header                — title + lede
 *   2. CurrentPlanCard       — current plan/status + cancel/reactivate
 *   3. UsageSection          — 3 progress bars vs plan limits
 *   4. PlanComparisonGrid    — 4 plans side-by-side + checkout CTA
 *   5. PaymentMethodsList    — saved methods + LS portal redirect
 *   6. InvoicesList          — historical invoices + PDF download
 *   7. PromoCodeForm         — validate promo before checkout
 *
 * The page reuses F1+ hooks (useCurrentUser implicit via container) and
 * introduces F7 hooks (useBilling, useInvoices, usePaymentMethods).
 * Composition root usage stays confined to the hooks themselves — this
 * page only orchestrates.
 */

import type { JSX } from "react";
import { Pill, Spinner } from "@/design-system/primitives";
import { useBilling } from "@/presentation/hooks/use-billing";
import { useInvoices } from "@/presentation/hooks/use-invoices";
import { usePaymentMethods } from "@/presentation/hooks/use-payment-methods";
import { CurrentPlanCard } from "@/presentation/components/billing/CurrentPlanCard";
import { PlanComparisonGrid } from "@/presentation/components/billing/PlanComparisonGrid";
import { UsageSection } from "@/presentation/components/billing/UsageSection";
import { PaymentMethodsList } from "@/presentation/components/billing/PaymentMethodsList";
import { InvoicesList } from "@/presentation/components/billing/InvoicesList";
import { PromoCodeForm } from "@/presentation/components/billing/PromoCodeForm";

export default function BillingPage(): JSX.Element {
  const {
    plans,
    subscription,
    currentPlan,
    usage,
    loading: billingLoading,
    error: billingError,
  } = useBilling();
  const {
    invoices,
    loading: invoicesLoading,
  } = useInvoices();
  const {
    paymentMethods,
    loading: pmLoading,
  } = usePaymentMethods();

  // Hard loading state — wait for the catalog before rendering anything
  // meaningful (the price comparison + plan card both require it).
  if (billingLoading && plans.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 24,
          color: "var(--color-text-mid)",
          fontSize: 14,
        }}
      >
        <Spinner size={18} />
        <span>Cargando facturación…</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 32,
        maxWidth: 1100,
      }}
    >
      <header>
        <Pill variant="ghost">Facturación</Pill>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "-1.4px",
            margin: "12px 0 8px",
          }}
        >
          Facturación
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-mid)",
            fontSize: 16,
            lineHeight: 1.5,
            maxWidth: 640,
          }}
        >
          Gestioná tu plan, métodos de pago, facturas y uso del mes en un
          solo lugar.
        </p>
      </header>

      {billingError ? (
        <div
          role="alert"
          style={{
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
            padding: 12,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {billingError}
        </div>
      ) : null}

      <CurrentPlanCard
        subscription={subscription}
        currentPlan={currentPlan}
      />

      <UsageSection usage={usage} currentPlan={currentPlan} />

      <PlanComparisonGrid
        plans={plans}
        currentPlanId={subscription?.planId ?? null}
        currentPlanCode={currentPlan?.code ?? null}
      />

      <PaymentMethodsList
        paymentMethods={paymentMethods}
        loading={pmLoading}
      />

      <InvoicesList invoices={invoices} loading={invoicesLoading} />

      <PromoCodeForm />
    </div>
  );
}
