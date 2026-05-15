"use client";

/**
 * useCheckout — encapsulates the "click upgrade" → checkout redirect flow.
 *
 * Behaviour:
 *  - Calls CreateCheckoutUseCase to obtain a checkout URL (Lemon Squeezy
 *    in prod; dev mock URL in dev mode that loops back to the backend
 *    /dev/billing/mock-checkout endpoint).
 *  - Redirects the browser via window.location.href so the user lands
 *    on the LS hosted checkout. After payment, LS redirects back to
 *    /app/billing where useBilling refreshes state.
 *  - Exposes loading/error so the calling button can show "Redirigiendo…".
 *
 * The hook does NOT optimistically update the store — the round-trip
 * after payment via `useBilling.refresh()` is the source of truth.
 */

import { useCallback, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";

interface UseCheckoutResult {
  redirecting: boolean;
  error: string | null;
  start: (planId: string, promoCode?: string | null) => Promise<void>;
}

export function useCheckout(): UseCheckoutResult {
  const { createCheckout } = useContainer();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (planId: string, promoCode?: string | null): Promise<void> => {
      setRedirecting(true);
      setError(null);
      try {
        const result = await createCheckout.execute({
          planId,
          promoCode: promoCode ?? null,
        });
        if (typeof window !== "undefined") {
          window.location.href = result.checkoutUrl;
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "No pudimos abrir el checkout. Probá de nuevo en un minuto.";
        // eslint-disable-next-line no-console -- dev surface
        console.error("[susurra] createCheckout failed:", err);
        setError(msg);
        setRedirecting(false);
      }
      // NOTE: on success we leave `redirecting=true` because the page is
      // about to navigate away — flipping it back would briefly re-render
      // the button into its idle state.
    },
    [createCheckout],
  );

  return { redirecting, error, start };
}
