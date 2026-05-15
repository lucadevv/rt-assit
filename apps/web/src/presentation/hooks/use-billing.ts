"use client";

/**
 * useBilling — orchestrates the three "always-loaded" billing reads:
 * plans (catalog), subscription (current), usage (current period).
 *
 * Why fetched together:
 *  - The Billing page renders Plan picker (needs plans + sub),
 *    Current plan card (needs sub + plan), and Usage section
 *    (needs usage + plan limits). Loading them in parallel keeps the
 *    above-the-fold render synchronous after a single round-trip.
 *  - Errors on any one of the three are surfaced as a single string —
 *    the page renders best-effort with whatever loaded.
 *
 * The store is the single source of truth; this hook just wires the
 * fetches and exposes a `refresh()` callback for mutations to retrigger.
 */

import { useCallback, useEffect, useRef } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useBillingStore } from "@/application/stores/billing.store";
import type { Plan } from "@/domain/entities/plan";
import type { Subscription } from "@/domain/entities/subscription";
import type { Usage } from "@/domain/entities/usage";

interface UseBillingResult {
  plans: Plan[];
  subscription: Subscription | null;
  currentPlan: Plan | null;
  usage: Usage | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBilling(): UseBillingResult {
  const { listPlans, getSubscription, getCurrentUsage } = useContainer();
  const plans = useBillingStore((s) => s.plans);
  const subscription = useBillingStore((s) => s.subscription);
  const currentPlan = useBillingStore((s) => s.currentPlan);
  const usage = useBillingStore((s) => s.usage);
  const loading = useBillingStore((s) => s.loading);
  const error = useBillingStore((s) => s.error);
  const setPlans = useBillingStore((s) => s.setPlans);
  const setSubscription = useBillingStore((s) => s.setSubscription);
  const setUsage = useBillingStore((s) => s.setUsage);
  const setLoading = useBillingStore((s) => s.setLoading);
  const setError = useBillingStore((s) => s.setError);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [plansResult, subResult, usageResult] = await Promise.allSettled([
        listPlans.execute(),
        getSubscription.execute(),
        getCurrentUsage.execute(),
      ]);

      if (plansResult.status === "fulfilled") {
        setPlans(plansResult.value);
      } else {
        // eslint-disable-next-line no-console -- dev surface
        console.error("[susurra] listPlans failed:", plansResult.reason);
      }

      if (subResult.status === "fulfilled") {
        setSubscription(subResult.value);
      } else {
        // eslint-disable-next-line no-console -- dev surface
        console.error("[susurra] getSubscription failed:", subResult.reason);
      }

      if (usageResult.status === "fulfilled") {
        setUsage(usageResult.value);
      } else {
        // Usage may transiently fail (e.g. period reset race) — log and
        // keep going. UI degrades gracefully (shows spinner / empty bars).
        // eslint-disable-next-line no-console -- dev surface
        console.warn("[susurra] getCurrentUsage failed:", usageResult.reason);
      }

      const failures = [plansResult, subResult].filter(
        (r) => r.status === "rejected",
      );
      if (failures.length === plans.length || failures.length === 2) {
        // Both critical reads failed → surface error.
        setError("No pudimos cargar tu información de facturación.");
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cargar tu información de facturación.";
      setError(msg);
    } finally {
      setLoading(false);
    }
    // `plans.length` is just a guard; the store update is what we depend on
    // — including the setters keeps this stable across renders.
  }, [
    listPlans,
    getSubscription,
    getCurrentUsage,
    setPlans,
    setSubscription,
    setUsage,
    setLoading,
    setError,
    plans.length,
  ]);

  // StrictMode dedup: in dev, React mounts effects twice to surface
  // side-effect bugs. We only want the initial fetch once. `refresh()`
  // remains callable manually after mutations.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void refresh();
    // refresh is stable thanks to useCallback — eslint exhaustive-deps
    // satisfied by listing it directly.
  }, [refresh]);

  return {
    plans,
    subscription,
    currentPlan,
    usage,
    loading,
    error,
    refresh,
  };
}
