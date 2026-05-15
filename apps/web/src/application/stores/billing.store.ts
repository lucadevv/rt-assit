/**
 * Billing store (Zustand) — caches plans, subscription, current plan
 * (derived) and current-month usage.
 *
 * Why a single store (vs three smaller ones):
 *   - `currentPlan` is a derived value from `subscription.planId` against
 *     `plans`; keeping derivation inside `setSubscription`/`setPlans`
 *     means consumers see a consistent slice with no extra useMemo.
 *   - The Billing UI loads all three at once, so colocating reduces
 *     re-render churn vs. three separate stores subscribing to each
 *     other.
 *
 * The store holds DOMAIN data only — no api response shapes, no fetch
 * state besides loading/error. The hook layer (`useBilling`) drives
 * loads; components subscribe via Zustand selectors.
 */

import { create } from "zustand";
import type { Plan } from "@/domain/entities/plan";
import type { Subscription } from "@/domain/entities/subscription";
import type { Usage } from "@/domain/entities/usage";

interface BillingStoreState {
  plans: Plan[];
  subscription: Subscription | null;
  /** Derived from subscription.planId + plans. Null when no subscription
   *  or when the plan id is not (yet) in the catalog. */
  currentPlan: Plan | null;
  usage: Usage | null;
  loading: boolean;
  error: string | null;

  setPlans: (plans: Plan[]) => void;
  setSubscription: (sub: Subscription | null) => void;
  setUsage: (usage: Usage | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const findPlan = (plans: Plan[], planId: string | undefined): Plan | null => {
  if (!planId) return null;
  return plans.find((p) => p.id === planId) ?? null;
};

export const useBillingStore = create<BillingStoreState>((set, get) => ({
  plans: [],
  subscription: null,
  currentPlan: null,
  usage: null,
  loading: false,
  error: null,

  setPlans: (plans) => {
    const sub = get().subscription;
    const currentPlan = findPlan(plans, sub?.planId);
    set({ plans, currentPlan });
  },
  setSubscription: (sub) => {
    const plans = get().plans;
    const currentPlan = findPlan(plans, sub?.planId);
    set({ subscription: sub, currentPlan });
  },
  setUsage: (usage) => set({ usage }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      plans: [],
      subscription: null,
      currentPlan: null,
      usage: null,
      loading: false,
      error: null,
    }),
}));
