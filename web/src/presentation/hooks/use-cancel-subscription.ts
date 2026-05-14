"use client";

/**
 * useCancelSubscription — wraps cancel + reactivate as a single hook so
 * the CurrentPlanCard can swap between "Cancelar" and "Reactivar" with
 * one consistent state machine.
 *
 * Optimistic updates: the store is updated with the authoritative
 * response from the backend, so we never leave the UI in a stale state
 * after a failed call. We DON'T pre-flip cancel_at_period_end because
 * the backend may also update other fields (canceled_at, period dates).
 */

import { useCallback, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useBillingStore } from "@/application/stores/billing.store";

interface UseCancelSubscriptionResult {
  pending: boolean;
  error: string | null;
  cancel: () => Promise<boolean>;
  reactivate: () => Promise<boolean>;
}

export function useCancelSubscription(): UseCancelSubscriptionResult {
  const { cancelSubscription, reactivateSubscription, analytics } = useContainer();
  const setSubscription = useBillingStore((s) => s.setSubscription);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(async (): Promise<boolean> => {
    setPending(true);
    setError(null);
    try {
      const updated = await cancelSubscription.execute();
      setSubscription(updated);
      analytics.track({ name: "subscription_canceled" });
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cancelar tu suscripción.";
      // eslint-disable-next-line no-console -- dev surface
      console.error("[auri] cancelSubscription failed:", err);
      setError(msg);
      return false;
    } finally {
      setPending(false);
    }
  }, [cancelSubscription, setSubscription, analytics]);

  const reactivate = useCallback(async (): Promise<boolean> => {
    setPending(true);
    setError(null);
    try {
      const updated = await reactivateSubscription.execute();
      setSubscription(updated);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos reactivar tu suscripción.";
      // eslint-disable-next-line no-console -- dev surface
      console.error("[auri] reactivateSubscription failed:", err);
      setError(msg);
      return false;
    } finally {
      setPending(false);
    }
  }, [reactivateSubscription, setSubscription]);

  return { pending, error, cancel, reactivate };
}
