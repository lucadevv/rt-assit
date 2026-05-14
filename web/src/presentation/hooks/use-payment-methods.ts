"use client";

/**
 * usePaymentMethods — load the user's saved payment methods.
 *
 * In dev mode the backend returns []. The Billing UI links the user
 * out to the LS portal (via `useContainer().getPortalUrl.execute()`)
 * for managing methods.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { PaymentMethod } from "@/domain/entities/payment-method";

interface UsePaymentMethodsResult {
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePaymentMethods(): UsePaymentMethodsResult {
  const { listPaymentMethods } = useContainer();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await listPaymentMethods.execute();
      setPaymentMethods(fresh);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cargar tus métodos de pago.";
      // eslint-disable-next-line no-console -- dev surface
      console.error("[auri] listPaymentMethods failed:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [listPaymentMethods]);

  // StrictMode dedup: only run the initial fetch once per real mount.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void refresh();
  }, [refresh]);

  return { paymentMethods, loading, error, refresh };
}
