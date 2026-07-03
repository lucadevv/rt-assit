"use client";

/**
 * useCurrentUser — exposes the authenticated user (with full domain shape:
 * tier, language, timestamps) to components.
 *
 * Fase D cookie-only flow:
 *   1. On mount, unconditionally fetch GET /api/me — cookies are the source
 *      of truth in the browser, so we always ask the backend "who am I?".
 *   2. 200 → seed store with full user, fire analytics identify (+ optional
 *      signup event if account was just created).
 *   3. 401 → FetchApiClient interceptor tries /refresh; if that fails it
 *      calls onSessionExpired which hard-navigates to /sign-in. We catch
 *      SessionExpiredError silently and clear local store.
 *   4. Other errors → clear store; AuthGuard sees user=null and redirects.
 *
 * Single-fire via `fetchedRef` — StrictMode dev double-mount must not
 * trigger two /api/me calls.
 */

import { useEffect } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
import { NetworkError } from "@/infrastructure/http/network.error";
import { SessionExpiredError } from "@/infrastructure/http/session-expired.error";
import type { User } from "@/domain/entities/user";

interface UseCurrentUserResult {
  user: User | null;
  loading: boolean;
}

const SIGNUP_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Stale window for /api/me. While the timestamp in the auth store is
 * younger than this, the hook skips the fetch. This dedups across:
 *  - StrictMode dev double-mount
 *  - HMR-driven component remounts
 *  - Concurrent mounts of useCurrentUser in sibling subtrees
 *
 * 30s is short enough that any tier/language change reaches the UI
 * promptly, and long enough that HMR-mass-remount won't hammer the API.
 */
const ME_STALE_MS = 30_000;

export function useCurrentUser(): UseCurrentUserResult {
  const { getCurrentUser, analytics } = useContainer();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setLastFetchedMeAt = useAuthStore((s) => s.setLastFetchedMeAt);

  useEffect(() => {
    // Dedup via store-level timestamp — survives remount because Zustand
    // is module-singleton. Reads the freshest value via getState().
    const lastFetched = useAuthStore.getState().lastFetchedMeAt;
    if (lastFetched !== null && Date.now() - lastFetched < ME_STALE_MS) {
      return;
    }
    // Mark fetch as inflight BEFORE the await so concurrent mounts skip.
    setLastFetchedMeAt(Date.now());

    setLoading(true);
    getCurrentUser
      .execute()
      .then((enriched) => {
        setUser(enriched);
        analytics.identify(enriched.id, { tier: enriched.tier });
        const createdAt = enriched.createdAt
          ? new Date(enriched.createdAt).getTime()
          : null;
        if (
          createdAt !== null &&
          Number.isFinite(createdAt) &&
          Date.now() - createdAt < SIGNUP_THRESHOLD_MS
        ) {
          analytics.track({ name: "signup", tier: enriched.tier });
        }
      })
      .catch((err: unknown) => {
        // Roll back the timestamp so a retry can happen sooner than the
        // stale window (e.g. user clicks back to /app after a flaky net).
        setLastFetchedMeAt(null);
        if (err instanceof NetworkError) {
          // Transport failure — backend unreachable. Keep the current
          // user state intact (don't sign the user out) so the UI stays
          // mounted; a future user action will retry naturally.
          // eslint-disable-next-line no-console -- intentional dev signal
          console.warn("[susurra] /api/me unreachable (network)");
          return;
        }
        if (err instanceof SessionExpiredError) {
          setUser(null);
          analytics.reset();
          return;
        }
        // eslint-disable-next-line no-console -- surfaced to dev console for debugging
        console.error("[susurra] failed to fetch /api/me:", err);
        setUser(null);
        analytics.reset();
      });
  }, [getCurrentUser, setUser, setLoading, setLastFetchedMeAt, analytics]);

  return { user, loading };
}
