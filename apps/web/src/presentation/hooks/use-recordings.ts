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

import { useCallback, useEffect, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
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

const RECORDINGS_STALE_MS = 30_000;

// Module-scope dedup state — no Zustand store for recordings (data lives
// in local state). Survives HMR remount the same way Zustand does.
// `tierKey` is bundled so a tier flip (Free→Pro) bypasses the stale window.
let recordingsLastFetchedAt: number | null = null;
let recordingsLastTierKey: string | null = null;

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

  // Gate fetch on authenticated user (auth store = single source of truth).
  const isAuthed = useAuthStore((s) => s.user !== null);

  // Dedup with stale window + tier-change override. A tier flip
  // (Free→Pro after billing loads) bypasses the window and re-fetches;
  // within the same tier, HMR remounts within 30s are deduped.
  const fetchKey = String(tierGate.available);
  useEffect(() => {
    if (!isAuthed) return;
    if (
      recordingsLastTierKey === fetchKey &&
      recordingsLastFetchedAt !== null &&
      Date.now() - recordingsLastFetchedAt < RECORDINGS_STALE_MS
    ) {
      return;
    }
    recordingsLastTierKey = fetchKey;
    recordingsLastFetchedAt = Date.now();
    void refresh().catch(() => {
      recordingsLastFetchedAt = null;
    });
  }, [fetchKey, isAuthed, refresh]);

  return { recordings, loading, error, refresh, tierGate };
}
