"use client";

/**
 * PostHogAnalyticsAdapter — concrete AnalyticsPort backed by posthog-js.
 *
 * Configuration:
 *  - `capture_pageview: false` — we capture page_view manually so SPA
 *    transitions are tracked exactly once per route change.
 *  - `autocapture: false` — we trust the explicit catalog over wide
 *    DOM-event capturing (avoids leaking PII via labels / inputs).
 *  - `session_recording: { maskAllInputs: true }` — defensive default; an
 *    upgrade tier may flip this off for opted-in sessions only.
 */

import posthog from "posthog-js";
import type {
  AnalyticsEvent,
  AnalyticsPort,
} from "@/application/ports/analytics.port";

export class PostHogAnalyticsAdapter implements AnalyticsPort {
  private initialized = false;

  init(apiKey: string, host?: string): void {
    if (this.initialized || typeof window === "undefined") return;
    posthog.init(apiKey, {
      api_host: host ?? "https://us.i.posthog.com",
      capture_pageview: false,
      autocapture: false,
      session_recording: { maskAllInputs: true },
    });
    this.initialized = true;
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.initialized) return;
    if (traits) {
      posthog.identify(userId, traits);
    } else {
      posthog.identify(userId);
    }
  }

  track(event: AnalyticsEvent): void {
    if (!this.initialized) return;
    const { name, ...properties } = event;
    posthog.capture(name, properties as Record<string, unknown>);
  }

  reset(): void {
    if (!this.initialized) return;
    posthog.reset();
  }
}
