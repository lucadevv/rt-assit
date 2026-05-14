"use client";

/**
 * Analytics factory — exposes a single AnalyticsPort instance per
 * window. Branches on `NEXT_PUBLIC_POSTHOG_KEY` at runtime: when the key
 * is set we lazily initialise the PostHog adapter; otherwise we fall back
 * to the noop adapter.
 *
 * The instance is memoised at module scope (singleton-per-window) so
 * every consumer of `useContainer().analytics` shares one underlying
 * provider — important because PostHog is itself a singleton at the SDK
 * level.
 */

import { PostHogAnalyticsAdapter } from "./posthog-adapter";
import { NoopAnalyticsAdapter } from "./noop-adapter";
import type { AnalyticsPort } from "@/application/ports/analytics.port";

let instance: AnalyticsPort | null = null;

export function createAnalytics(): AnalyticsPort {
  if (instance) return instance;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (apiKey && typeof window !== "undefined") {
    const adapter = new PostHogAnalyticsAdapter();
    adapter.init(apiKey, host);
    instance = adapter;
  } else {
    instance = new NoopAnalyticsAdapter();
  }

  return instance;
}
