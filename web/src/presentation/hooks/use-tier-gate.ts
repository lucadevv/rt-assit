"use client";

/**
 * useTierGate(feature) — the cornerstone of Auri's tier gating UI.
 *
 * Returns whether `feature` is unlocked for the user's current plan,
 * along with `requiredTier` so the caller can render an upgrade banner
 * pointing at the cheapest plan that unlocks it.
 *
 * Usage from any component (no extra setup — the BillingStore is
 * populated globally by `useBilling` on mount of /app/billing or any
 * other page that consumes it):
 *
 *   const gate = useTierGate("voice_fingerprinting");
 *   if (!gate.available) {
 *     return <UpgradeBanner feature="diarización avanzada"
 *                           requiredTier={gate.requiredTier} />;
 *   }
 *
 * Memoised on (feature, currentPlan) so callers can call this hook in
 * render hot paths without thrashing.
 *
 * IMPORTANT: this hook reads `currentPlan` from BillingStore. If no page
 * has loaded the catalog yet (cold mount), `currentPlan` is null and
 * the hook returns `{ available: false, reason: "no_subscription" }`.
 * Pages that gate features should also call `useBilling()` to ensure
 * the store is populated. The orchestrator pattern is documented in
 * the Billing page (which calls it once for the whole app shell).
 */

import { useMemo } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useBillingStore } from "@/application/stores/billing.store";
import type {
  Feature,
  FeatureAvailability,
} from "@/application/use-cases/check-feature-availability";

export type { Feature, FeatureAvailability } from "@/application/use-cases/check-feature-availability";

export function useTierGate(feature: Feature): FeatureAvailability {
  const { checkFeatureAvailability } = useContainer();
  const currentPlan = useBillingStore((s) => s.currentPlan);

  return useMemo(
    () => checkFeatureAvailability.execute(feature, currentPlan),
    [checkFeatureAvailability, feature, currentPlan],
  );
}
