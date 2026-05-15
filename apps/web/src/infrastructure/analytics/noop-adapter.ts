"use client";

/**
 * NoopAnalyticsAdapter — fallback when no provider is configured.
 *
 * Preserves the call site so consumers do not branch on
 * `analytics?.track`; in dev we mirror events to `console.debug` so
 * developers can sanity-check the catalog locally without spinning up a
 * PostHog instance.
 */

import type {
  AnalyticsEvent,
  AnalyticsPort,
} from "@/application/ports/analytics.port";

export class NoopAnalyticsAdapter implements AnalyticsPort {
  identify(_userId: string, _traits?: Record<string, unknown>): void {
    // intentional no-op
  }

  track(event: AnalyticsEvent): void {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console -- deliberate dev-mode mirror
      console.debug("[analytics:noop]", event);
    }
  }

  reset(): void {
    // intentional no-op
  }
}
