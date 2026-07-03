"use client";

/**
 * useOnboardingStatus — decides whether the user should be redirected to
 * /app/onboarding.
 *
 * Source of truth (v2, beta-launch):
 *   `UserPreferences.onboardingComplete` on the backend — flipped to True
 *   by the wizard via POST /api/me/onboarding/complete on finish or
 *   explicit skip.
 *
 * Backward compatibility:
 *   The v1 wizard relied on a localStorage flag
 *   (`susurra-onboarding-completed`). We keep honouring that flag as a
 *   short-circuit so users who already completed the v1 flow before the
 *   backend migration shipped don't get the new wizard forced on them.
 *
 * Why fetch here (not via usePreferences) — `usePreferences` is mounted
 * inside Settings only; this hook runs at app boot for the redirect, so
 * we own a dedicated fetch path against the same use case. The container
 * is the single source of HTTP truth.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";

const ONBOARDING_FLAG_KEY = "susurra-onboarding-completed";

interface UseOnboardingStatusResult {
  loading: boolean;
  shouldShow: boolean;
  markCompleted: () => Promise<void>;
}

export function useOnboardingStatus(): UseOnboardingStatusResult {
  const { getPreferences, markOnboardingComplete } = useContainer();
  const [serverComplete, setServerComplete] = useState<boolean | null>(null);
  const [localComplete, setLocalComplete] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);

  // Auth-gated: don't fetch /api/preferences until the user is known.
  const isAuthed = useAuthStore((s) => s.user !== null);

  // Read localStorage once on mount — sticky completion flag from v1.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem(ONBOARDING_FLAG_KEY);
    setLocalComplete(flag === "true");
  }, []);

  // Fetch the server flag exactly once per real mount (StrictMode-safe).
  // If the request fails (backend down, 401 between hops), `loadError`
  // flips and we degrade to "don't redirect" — better to skip the wizard
  // than to trap the user on the onboarding route forever.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!isAuthed) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getPreferences
      .execute()
      .then((prefs) => {
        setServerComplete(prefs.onboardingComplete);
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console -- dev signal only
        console.warn("[susurra] failed to fetch onboarding flag:", err);
        setLoadError(true);
      });
  }, [isAuthed, getPreferences]);

  const markCompleted = useCallback(async (): Promise<void> => {
    // Mirror to localStorage immediately so a refresh mid-completion
    // doesn't bounce the user back to the wizard while the network is
    // in flight. The backend remains authoritative — next fetch reconciles.
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_FLAG_KEY, "true");
    }
    setLocalComplete(true);
    setServerComplete(true);
    try {
      await markOnboardingComplete.execute();
    } catch (err) {
      // eslint-disable-next-line no-console -- dev signal only
      console.warn("[susurra] failed to persist onboarding flag:", err);
      // Local flag stays True so the user isn't trapped — they can
      // always re-enter /app/onboarding manually if needed. The backend
      // will catch up on the next preferences update.
    }
  }, [markOnboardingComplete]);

  // Loading: waiting on either the localStorage probe or the server
  // round-trip (but only while authed — anon users never trigger).
  const localLoaded = localComplete !== null;
  const serverLoaded = serverComplete !== null || loadError || !isAuthed;
  const loading = !localLoaded || !serverLoaded;

  // shouldShow rules:
  //   1. If the user is not authed, never show (router gates anyway).
  //   2. If the local sticky flag is True (legacy v1), never show.
  //   3. If the server says complete, never show.
  //   4. If we still don't know either flag, don't show (loading state).
  //   5. If the server fetch errored, don't show (fail-open — wizard is
  //      a soft requirement, not a hard gate).
  //   6. Otherwise → show.
  const shouldShow =
    isAuthed &&
    localComplete === false &&
    serverComplete === false;

  return {
    loading,
    shouldShow,
    markCompleted,
  };
}
