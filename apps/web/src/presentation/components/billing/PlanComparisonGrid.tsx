"use client";

/**
 * PlanComparisonGrid — 4 plan cards side-by-side (Free / Pro / Premium /
 * BYOK) with feature matrix and a CTA per plan.
 *
 * Feature matrix is derived from `plan.limits` per plan so adding a new
 * feature anywhere only touches the FEATURE_ROWS table here. Each row
 * resolves a check (✓), a lock (✗), or a custom string (e.g. "5 docs").
 *
 * CTAs:
 *  - Plan actual                 → ghost button "Plan actual" (disabled)
 *  - Free  (and current=paid)    → ghost button "Bajar a Free" (downgrade)
 *  - Higher tier than current    → primary "Mejorar" → checkout flow
 *  - Lower tier than current     → ghost "Cambiar" → downgrade flow
 *
 * The grid groups plans by `code` so "pro_monthly" and "pro_yearly"
 * share a column (we display whichever monthly variant exists; yearly
 * upsell is handled in a future revision).
 */

import { useCallback, useMemo, type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import type { Plan, PlanCode } from "@/domain/entities/plan";
import { useCheckout } from "@/presentation/hooks/use-checkout";
import { useAnalytics } from "@/presentation/hooks/use-analytics";
import {
  formatMoneyCents,
  planPillVariant,
  tierName,
  TIER_RANK,
} from "./utils";

interface PlanComparisonGridProps {
  plans: Plan[];
  currentPlanId: string | null;
  currentPlanCode: PlanCode | null;
}

interface FeatureRow {
  label: string;
  /** Returns either a boolean (✓/✗) or a textual cell. */
  resolve: (plan: Plan) => boolean | string;
}

const FEATURE_ROWS: readonly FeatureRow[] = [
  {
    label: "Sesiones",
    resolve: (p) =>
      p.limits.max_session_duration_minutes === null
        ? "Ilimitadas"
        : `${p.limits.max_session_duration_minutes} min`,
  },
  {
    label: "Documentos",
    resolve: (p) =>
      p.limits.max_docs === null ? "Ilimitados" : `${p.limits.max_docs} docs`,
  },
  {
    label: "Grabaciones",
    resolve: (p) =>
      p.limits.max_recordings === null
        ? "Ilimitadas"
        : p.limits.max_recordings === 0
          ? false
          : `${p.limits.max_recordings} grab.`,
  },
  {
    label: "Diarización (separar voces)",
    resolve: (p) => p.limits.diarization_enabled,
  },
  {
    label: "Voice fingerprinting",
    resolve: (p) => p.limits.voice_fingerprinting_enabled,
  },
  {
    label: "Stealth mode",
    resolve: (p) => p.limits.stealth_mode,
  },
  {
    label: "BYOK (tu propia API key)",
    resolve: (p) => p.limits.byok_enabled,
  },
  {
    label: "Soporte prioritario",
    resolve: (p) => p.limits.priority_support,
  },
  {
    label: "Export PDF",
    resolve: (p) => p.limits.export_formats.includes("pdf"),
  },
  {
    label: "Tweaks completos (3+3+3)",
    resolve: (p) =>
      p.limits.tweaks_layouts_unlocked.length >= 3 &&
      p.limits.tweaks_hint_styles_unlocked.length >= 3 &&
      p.limits.tweaks_transcript_styles_unlocked.length >= 3,
  },
];

const PLAN_ORDER: readonly PlanCode[] = ["free", "pro", "premium", "byok"];

/** Picks one canonical plan per `code` (preferring monthly cycle for paid). */
function pickCanonicalPlans(plans: Plan[]): Map<PlanCode, Plan> {
  const out = new Map<PlanCode, Plan>();
  for (const code of PLAN_ORDER) {
    const candidates = plans.filter((p) => p.code === code && p.isActive);
    if (candidates.length === 0) continue;
    // Prefer monthly cycle (or the sole option for free/byok).
    const monthly = candidates.find((p) => p.billingCycle === "monthly");
    out.set(code, monthly ?? candidates[0]!);
  }
  return out;
}

function FeatureCell({ value }: { value: boolean | string }): JSX.Element {
  if (typeof value === "string") {
    return (
      <span style={{ fontSize: 13, color: "var(--color-text)" }}>{value}</span>
    );
  }
  if (value) {
    return (
      <span
        aria-label="Incluido"
        title="Incluido"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 9999,
          background: "var(--color-lime)",
          color: "var(--color-lime-ink)",
          fontWeight: 800,
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        ✓
      </span>
    );
  }
  return (
    <span
      aria-label="No incluido"
      title="No incluido"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 9999,
        background: "transparent",
        color: "var(--color-text-dim)",
        border: "1px solid var(--color-border)",
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      ✗
    </span>
  );
}

export function PlanComparisonGrid({
  plans,
  currentPlanId,
  currentPlanCode,
}: PlanComparisonGridProps): JSX.Element {
  const canonical = useMemo(() => pickCanonicalPlans(plans), [plans]);
  const { redirecting, error: checkoutError, start: startCheckout } =
    useCheckout();
  const { track } = useAnalytics();

  const orderedCodes = PLAN_ORDER.filter((c) => canonical.has(c));
  const currentRank = currentPlanCode ? TIER_RANK[currentPlanCode] : -1;

  const handlePlanClick = useCallback(
    (targetCode: PlanCode, planId: string) => {
      track({
        name: "upgrade_clicked",
        from: currentPlanCode ?? "anonymous",
        to: targetCode,
      });
      void startCheckout(planId);
    },
    [track, currentPlanCode, startCheckout],
  );

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      aria-labelledby="plans-grid-title"
    >
      <header>
        <h2
          id="plans-grid-title"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.4px",
            color: "var(--color-text)",
          }}
        >
          Comparar planes
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
            maxWidth: 560,
          }}
        >
          Cambiá de plan en cualquier momento. Las mejoras se aplican al
          instante; las bajas se programan para el final del período actual.
        </p>
      </header>

      {checkoutError ? (
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
          {checkoutError}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {orderedCodes.map((code) => {
          const plan = canonical.get(code)!;
          const isCurrent = plan.id === currentPlanId;
          const targetRank = TIER_RANK[code];
          const isUpgrade = targetRank > currentRank;
          const isDowngrade = targetRank < currentRank && currentRank >= 0;
          const cycleLabel =
            plan.billingCycle === "yearly"
              ? "/año"
              : plan.billingCycle === "monthly"
                ? "/mes"
                : "";

          return (
            <Card
              key={plan.id}
              variant={isCurrent ? "soft" : "default"}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: 18,
                position: "relative",
                outline: isCurrent
                  ? `2px solid var(--color-lime)`
                  : "2px solid transparent",
              }}
            >
              <header
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <Pill variant={planPillVariant(code)}>{tierName(code)}</Pill>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.6px",
                    color: "var(--color-text)",
                  }}
                >
                  {plan.name}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "-0.8px",
                    color: "var(--color-text)",
                  }}
                >
                  {plan.priceCents === 0
                    ? "Gratis"
                    : formatMoneyCents(plan.priceCents, plan.currency)}
                  {plan.priceCents > 0 ? (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--color-text-mid)",
                        marginLeft: 4,
                      }}
                    >
                      {cycleLabel}
                    </span>
                  ) : null}
                </p>
                {plan.description ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--color-text-mid)",
                      lineHeight: 1.45,
                    }}
                  >
                    {plan.description}
                  </p>
                ) : null}
              </header>

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {FEATURE_ROWS.map((row) => (
                  <li
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--color-text)",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>{row.label}</span>
                    <FeatureCell value={row.resolve(plan)} />
                  </li>
                ))}
              </ul>

              <footer style={{ marginTop: "auto" }}>
                {isCurrent ? (
                  <Button variant="ghost" size="sm" disabled fullWidth>
                    Plan actual
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={redirecting}
                    onClick={() => handlePlanClick(code, plan.id)}
                  >
                    {redirecting
                      ? "Redirigiendo…"
                      : currentRank < 0
                        ? "Empezar"
                        : "Mejorar"}
                  </Button>
                ) : isDowngrade ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    disabled={redirecting}
                    onClick={() => handlePlanClick(code, plan.id)}
                  >
                    Cambiar
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    disabled={redirecting}
                    onClick={() => handlePlanClick(code, plan.id)}
                  >
                    Elegir
                  </Button>
                )}
              </footer>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
