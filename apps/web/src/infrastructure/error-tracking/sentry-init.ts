"use client";

/**
 * Sentry browser-side init.
 *
 * Triggered exactly once per page load by `app/layout.tsx`. Skipped when
 * `NEXT_PUBLIC_SENTRY_DSN` is missing — keeps OSS contributors free of
 * vendor coupling and prevents noisy "Sentry not configured" logs in dev.
 *
 * PII strategy: `beforeSend` strips email + username off the user payload.
 * Sample rates are deliberately conservative — 10% traces, 0% session
 * replays unless an error fires (then full replay buffer is uploaded).
 */

import * as Sentry from "@sentry/nextjs";

let initialized = false;

export function initSentry(): void {
  if (initialized || typeof window === "undefined") return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // eslint-disable-next-line no-console -- one-line dev breadcrumb
    console.debug("[sentry] no DSN configured, skipping init");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [],
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });

  initialized = true;
}
