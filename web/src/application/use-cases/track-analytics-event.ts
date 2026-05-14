/**
 * TrackAnalyticsEventUseCase — thin wrapper around the AnalyticsPort.
 *
 * Why a use case for a one-line forward? Two reasons:
 *  1. Future hooks (e.g. PII scrubbing, sample-rate gating, dev-only
 *     console mirroring) attach here without touching consumers.
 *  2. Keeps presentation depending on the application layer — never on
 *     `posthog-js` or any other vendor SDK.
 */

import type {
  AnalyticsEvent,
  AnalyticsPort,
} from "@/application/ports/analytics.port";

export class TrackAnalyticsEventUseCase {
  constructor(private readonly analytics: AnalyticsPort) {}

  execute(event: AnalyticsEvent): void {
    this.analytics.track(event);
  }
}
