/**
 * AnalyticsPort — provider-agnostic analytics interface.
 *
 * Discriminated union of supported events. Adding a new event requires
 * extending the union here AND a corresponding `track` call somewhere in
 * presentation. Adapters (PostHog / noop / future) implement the port and
 * pass `{ name, ...properties }` to whatever underlying SDK they use.
 *
 * Design notes:
 *  - Application layer must NEVER import the concrete adapters
 *    (posthog-js / etc.) — those live in infrastructure.
 *  - `identify(userId)` is decoupled from track so adapters can map a
 *    durable user id once and stamp every event with it automatically.
 *  - `reset()` is called on logout so the next anonymous session does not
 *    leak the previous user's traits.
 */

export type AnalyticsEvent =
  | { name: "signup"; tier: string }
  | {
      name: "onboarding_step";
      step: number;
      /**
       * - `completed`: the user advanced past this step normally.
       * - `skipped`: the user opted out of an optional step (e.g. CV upload).
       * - `back`: the user navigated backwards in the wizard.
       * - `cancelled`: the user abandoned the wizard mid-flow (does not
       *   mark onboarding complete on the backend).
       */
      action: "completed" | "skipped" | "back" | "cancelled";
    }
  | { name: "cv_uploaded"; method: "file" | "url" | "text" }
  | { name: "session_start"; scenario: string }
  | {
      name: "session_end";
      scenario: string;
      durationSeconds: number;
    }
  | { name: "speaker_renamed" }
  | {
      name: "tweak_changed";
      tweak:
        | "layout"
        | "hint_style"
        | "transcript_style"
        | "screen_ocr_enabled";
      value: string;
    }
  | { name: "pip_opened" }
  | { name: "recording_played" }
  | { name: "share_link_created"; permissions: string }
  | { name: "upgrade_clicked"; from: string; to: string }
  | { name: "subscription_canceled" }
  | { name: "page_view"; path: string };

export interface AnalyticsPort {
  /** Stamp the durable user id + optional traits on subsequent events. */
  identify(userId: string, traits?: Record<string, unknown>): void;
  /** Capture a single event. Idempotent and side-effect-free if disabled. */
  track(event: AnalyticsEvent): void;
  /** Drop the cached identity (logout). */
  reset(): void;
}
