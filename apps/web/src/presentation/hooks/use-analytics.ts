"use client";

/**
 * useAnalytics — presentation binding to the AnalyticsPort.
 *
 * Returns memoised `track` and `identify` callbacks so consumers can pass
 * them to `useEffect` deps without forcing every render to schedule a
 * tracking call. The `reset` action is exposed for the auth-store logout
 * flow.
 */

import { useCallback } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { AnalyticsEvent } from "@/application/ports/analytics.port";

interface UseAnalyticsResult {
  track: (event: AnalyticsEvent) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  reset: () => void;
}

export function useAnalytics(): UseAnalyticsResult {
  const { analytics } = useContainer();

  const track = useCallback(
    (event: AnalyticsEvent) => {
      analytics.track(event);
    },
    [analytics],
  );

  const identify = useCallback(
    (userId: string, traits?: Record<string, unknown>) => {
      analytics.identify(userId, traits);
    },
    [analytics],
  );

  const reset = useCallback(() => {
    analytics.reset();
  }, [analytics]);

  return { track, identify, reset };
}
