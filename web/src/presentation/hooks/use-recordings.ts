"use client";

/**
 * useRecordings — page-level hook for /app/recordings.
 *
 * Responsibilities:
 *  - Boot the BillingStore via `useBilling()` (so `useTierGate` has data).
 *  - Apply tier gate "recordings" (Pro+ only — Free returns empty list).
 *  - Fetch the user's recordings list once on mount, cached in local
 *    state. The list endpoint is paginated; F8 fetches up to 100 items
 *    (more than any user is realistically going to need on first load).
 *
 * Errors are caught and surfaced as a Spanish error string — the page
 * renders an inline amber alert without losing the rest of the UI.
 *
 * Refresh hook is exposed so post-mutation flows (e.g. after delete) can
 * refresh the list inline.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useBilling } from "./use-billing";
import { useTierGate } from "./use-tier-gate";
import type { FeatureAvailability } from "./use-tier-gate";
import type { RecordingWithSession } from "@/domain/entities/recording";

interface UseRecordingsResult {
  recordings: RecordingWithSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  tierGate: FeatureAvailability;
}

export function useRecordings(): UseRecordingsResult {
  const { listRecordings } = useContainer();
  // Boot the BillingStore so useTierGate has currentPlan available.
  // Errors from billing are intentionally swallowed here — the page
  // works fine even if billing is offline (degrades to "no_subscription").
  useBilling();
  const tierGate = useTierGate("recordings");

  const [recordings, setRecordings] = useState<RecordingWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!tierGate.available) {
      setRecordings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await listRecordings.execute({ limit: 100, offset: 0 });
      setRecordings(items);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cargar tus grabaciones.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [listRecordings, tierGate.available]);

  // StrictMode dedup with reactive key: tierGate.available flips from
  // false → true once billing loads. We re-fetch only when the actual
  // gate identity changes, not on dev-mode re-mounts.
  const lastFetchKeyRef = useRef<string | null>(null);
  const fetchKey = String(tierGate.available);
  useEffect(() => {
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    void refresh();
  }, [fetchKey, refresh]);

  return { recordings, loading, error, refresh, tierGate };
}
