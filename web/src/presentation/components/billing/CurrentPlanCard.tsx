"use client";

/**
 * CurrentPlanCard — top section of /app/billing.
 *
 * Shows:
 *  - Plan name (large) + tier-coloured pill
 *  - Status pill (Trialing / Activa / Cancelando / etc.)
 *  - Period info: trial expiry OR next billing date OR access-until
 *  - Actions: "Cancelar" (when active+not cancelling), "Reactivar"
 *    (when cancel_at_period_end=true).
 *
 * If there is no subscription, renders a compact CTA pointing to the
 * Plans grid below.
 */

import { useState, type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import type { Plan } from "@/domain/entities/plan";
import type { Subscription } from "@/domain/entities/subscription";
import { useCancelSubscription } from "@/presentation/hooks/use-cancel-subscription";
import { CancelConfirmModal } from "./CancelConfirmModal";
import {
  formatDateLong,
  formatMoneyCents,
  planPillVariant,
  subscriptionStatusDisplay,
  tierName,
} from "./utils";

interface CurrentPlanCardProps {
  subscription: Subscription | null;
  currentPlan: Plan | null;
}

export function CurrentPlanCard({
  subscription,
  currentPlan,
}: CurrentPlanCardProps): JSX.Element {
  const { pending, error, cancel, reactivate } = useCancelSubscription();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // No subscription → CTA card
  if (!subscription || !currentPlan) {
    return (
      <Card
        variant="soft"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <Pill variant="ghost">Sin suscripción activa</Pill>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.6px",
            }}
          >
            Empezá tu trial gratis
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 14,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            Probá Susurra Pro durante 14 días sin tarjeta. Después podés
            quedarte en Free o elegir el plan que mejor te quede.
          </p>
        </div>
      </Card>
    );
  }

  const statusDisplay = subscriptionStatusDisplay(
    subscription.status,
    subscription.cancelAtPeriodEnd,
  );
  const planVariant = planPillVariant(currentPlan.code);

  // Period text — different copy depending on status
  let periodLine: string;
  if (subscription.status === "trialing" && subscription.trialEnd) {
    periodLine = `Tu trial expira el ${formatDateLong(subscription.trialEnd)}.`;
  } else if (subscription.cancelAtPeriodEnd) {
    periodLine = `Tu acceso continúa hasta el ${formatDateLong(
      subscription.currentPeriodEnd,
    )}.`;
  } else if (subscription.currentPeriodEnd) {
    periodLine = `Próxima facturación: ${formatDateLong(
      subscription.currentPeriodEnd,
    )}.`;
  } else {
    periodLine = "Sin fecha de facturación programada.";
  }

  const isFree = currentPlan.code === "free";
  const showCancel =
    !isFree &&
    !subscription.cancelAtPeriodEnd &&
    (subscription.status === "active" || subscription.status === "trialing");
  const showReactivate = subscription.cancelAtPeriodEnd;

  const handleConfirmCancel = async (_reason: string): Promise<void> => {
    const ok = await cancel();
    if (ok) setConfirmOpen(false);
  };

  return (
    <>
      <Card
        variant="default"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Pill variant={planVariant}>Plan {tierName(currentPlan.code)}</Pill>
              <Pill variant={statusDisplay.variant}>{statusDisplay.label}</Pill>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: "-1px",
                color: "var(--color-text)",
              }}
            >
              {currentPlan.name}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--color-text-mid)",
                lineHeight: 1.5,
                maxWidth: 520,
              }}
            >
              {periodLine}
            </p>
            {!isFree && currentPlan.priceCents > 0 ? (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--color-text-dim)",
                }}
              >
                {formatMoneyCents(currentPlan.priceCents, currentPlan.currency)} /{" "}
                {currentPlan.billingCycle === "yearly" ? "año" : "mes"}
                {subscription.discountCents > 0
                  ? ` · descuento ${formatMoneyCents(
                      subscription.discountCents,
                      currentPlan.currency,
                    )}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {showReactivate ? (
              <Button
                variant="primary"
                size="md"
                disabled={pending}
                onClick={() => void reactivate()}
              >
                {pending ? "Reactivando…" : "Reactivar suscripción"}
              </Button>
            ) : null}
            {showCancel ? (
              <Button
                variant="ghost"
                size="md"
                onClick={() => setConfirmOpen(true)}
              >
                Cancelar suscripción
              </Button>
            ) : null}
          </div>
        </div>

        {error && !confirmOpen ? (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--color-amber)",
              color: "var(--color-amber-ink)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        ) : null}
      </Card>

      <CancelConfirmModal
        open={confirmOpen}
        periodEndIso={subscription.currentPeriodEnd}
        pending={pending}
        error={error}
        onConfirm={(reason) => void handleConfirmCancel(reason)}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
