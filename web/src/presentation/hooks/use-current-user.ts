"use client";

/**
 * useCurrentUser — exposes the authenticated user (with full domain shape:
 * tier, language, timestamps) to components.
 *
 * Flow on mount:
 *   1. Read AuthPort state synchronously.
 *   2. If `loading` -> mark store loading.
 *   3. If `unauthenticated` -> clear store.
 *   4. If `authenticated` -> immediately seed store with the auth-port user
 *      (id, email, name, avatar — no tier yet) so the UI renders fast,
 *      then fetch `/api/me` to enrich with tier/language/etc.
 *
 * The store is the source of truth for the rest of the app. This hook
 * exists once at the top of the protected layout so the network call
 * happens exactly once per session, not per consumer.
 */

import { useEffect, useRef } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
import type { User } from "@/domain/entities/user";

interface UseCurrentUserResult {
  user: User | null;
  loading: boolean;
}

/**
 * "Recently created" threshold for emitting `signup` analytics. We
 * intentionally pick a small window (5 min) so refreshing the page right
 * after signup still fires the event, but a normal repeat-visitor never
 * gets miscounted as a new signup.
 */
const SIGNUP_THRESHOLD_MS = 5 * 60 * 1000;

export function useCurrentUser(): UseCurrentUserResult {
  const { auth, getCurrentUser, analytics } = useContainer();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  // StrictMode dedup with reactive key: keyed by `${status}:${user_id}` so
  // login/logout/user-switch still triggers the enrich fetch, but the dev
  // double-mount does not re-call /api/me.
  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const state = auth.getState();
    const fetchKey = `${state.status}:${
      state.status === "authenticated" ? state.user.id : ""
    }`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    if (state.status === "loading") {
      setLoading(true);
      return;
    }
    if (state.status === "unauthenticated") {
      setUser(null);
      // Drop any cached identity in the analytics provider on logout.
      analytics.reset();
      return;
    }

    // Optimistic seed so the UI shows the avatar/name immediately.
    setUser(state.user);

    // Enrich with backend record (tier, language_preferred, real timestamps).
    getCurrentUser
      .execute()
      .then((enriched) => {
        setUser(enriched);
        // Stamp analytics identity (tier as trait — used in funnels).
        analytics.identify(enriched.id, { tier: enriched.tier });
        // Detect "just signed up" by comparing createdAt with now.
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
        // eslint-disable-next-line no-console -- surfaced to dev console for debugging
        console.error("[auri] failed to fetch /api/me:", err);
        // Keep the optimistic user — UI already has a usable identity.
      });
  }, [auth, getCurrentUser, setUser, setLoading, analytics]);

  return { user, loading };
}
