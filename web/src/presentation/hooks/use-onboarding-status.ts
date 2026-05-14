"use client";

/**
 * useOnboardingStatus — decides whether the user should be redirected to
 * /app/onboarding.
 *
 * Sources of truth:
 *   1. localStorage flag `auri-onboarding-completed` (sticky once set).
 *   2. `useDocuments().hasCv` — first-time users by definition have no CV.
 *
 * The flag wins: if the user explicitly skipped or finished onboarding,
 * we never redirect again — even if they later delete their CV. This is
 * the safer UX (we don't want to surprise users with a forced flow on
 * every login after they've made it past the first-run wizard).
 */

import { useEffect, useState } from "react";
import { useDocuments } from "./use-documents";

const ONBOARDING_FLAG_KEY = "auri-onboarding-completed";

interface UseOnboardingStatusResult {
  loading: boolean;
  shouldShow: boolean;
  markCompleted: () => void;
}

export function useOnboardingStatus(): UseOnboardingStatusResult {
  const { hasCv, hasFetched, loading: docsLoading } = useDocuments();
  const [completedFlag, setCompletedFlag] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem(ONBOARDING_FLAG_KEY);
    setCompletedFlag(flag === "true");
  }, []);

  const flagLoaded = completedFlag !== null;
  const loading = !flagLoaded || (!hasFetched && docsLoading);
  const shouldShow = completedFlag === false && hasFetched && !hasCv;

  const markCompleted = (): void => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ONBOARDING_FLAG_KEY, "true");
    setCompletedFlag(true);
  };

  return {
    loading,
    shouldShow,
    markCompleted,
  };
}
