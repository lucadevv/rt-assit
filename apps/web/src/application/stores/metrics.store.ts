/**
 * Metrics store — live conversational coaching metrics.
 *
 * Audience (PRODUCT.md): devs LATAM in tech interviews. Self-correction
 * during the call matters more than post-mortem analytics. We surface
 * three real-time signals derived from the existing transcript stream:
 *
 *   1. Talk ratio — % words spoken by the user vs the other side.
 *      Goal: avoid monopolising the conversation in interviews.
 *   2. WPM (words/minute) — rough pace indicator for the user.
 *      Hidden until 20 words sampled so the early jittery numbers
 *      don't distract.
 *   3. Monologue alert — fires when the user has been speaking
 *      continuously for >= 90s without the other side interjecting.
 *      Threshold rationale: in interviews, 90s without a pause is the
 *      practical edge where the interviewer starts disengaging.
 *
 * Architecture (frontend-only for v1):
 *   - Zero backend changes. We aggregate data the system ALREADY has
 *     (final transcripts on the session WS).
 *   - Pure derived state — cheap, no audio processing, no VAD.
 *   - Future expansion: when we want server-side reliability for premium
 *     tiers (cross-device session resume, audit trail), the same shape
 *     can move behind a use-case + REST endpoint without changing the
 *     UI.
 *
 * Speaker resolution:
 *   The transcript itself carries `deepgramSpeaker` (cluster id). The
 *   wiring layer (`use-conversation-metrics`) resolves that to a
 *   "you" | "them" label by looking up `Speaker.isUser` in the session
 *   store. This keeps the metrics store decoupled from the speaker
 *   entity — it only sees the resolved side.
 */

"use client";

import { create } from "zustand";

export type ConversationSide = "you" | "them";

interface SpeakerStats {
  totalWords: number;
  /**
   * Total wall-clock speaking time (ms) — approximate.
   *
   * v1: we don't compute this from VAD or per-utterance windows. The
   * field exists so we can graduate to a real value later (e.g. when we
   * have backend-side VAD) without changing the store contract. The
   * current UI only reads `totalWords` for WPM (divided by session
   * elapsed time, not per-speaker speaking time).
   */
  totalSpeakingTimeMs: number;
  /** ms timestamp of the last final transcript from this side. */
  lastSpokeAt: number | null;
}

interface RecordTranscriptInput {
  side: ConversationSide;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface MetricsState {
  sessionStartedAt: number | null;
  you: SpeakerStats;
  them: SpeakerStats;
  /**
   * ms timestamp when the current uninterrupted "you" run began. Resets
   * to null whenever "them" speaks. Drives `isMonologueAlert` via tick.
   */
  monologueStartedAt: number | null;
  /**
   * True when the current "you" run has lasted ≥ MONOLOGUE_THRESHOLD_MS.
   * Computed in `tick()` so the alert fires even during silence (no new
   * transcripts arriving) — the dangerous case in interviews.
   */
  isMonologueAlert: boolean;
  /**
   * Snapshot of the most recent `tick()`'s `Date.now()`. Only updated
   * while a monologue run is active. Existing for ONE reason: it lets
   * the selector `useMonologueDurationSec` re-render once per second
   * during a monologue (Zustand only re-runs subscribers when the
   * subscribed slice changes by identity). Without this field the
   * displayed counter would freeze at its initial value because
   * neither `monologueStartedAt` nor `isMonologueAlert` change during
   * the active run.
   */
  monologueLastTickMs: number;

  startSession(): void;
  recordTranscript(input: RecordTranscriptInput): void;
  tick(): void;
  reset(): void;
}

/**
 * Monologue threshold — 90 seconds.
 *
 * Rationale: 60s feels too tight (it's normal to elaborate a technical
 * answer for a minute). 120s is too late (the interviewer has already
 * disengaged). 90s is the practical sweet spot where a coaching nudge
 * is still actionable. Tunable if user feedback says otherwise.
 */
const MONOLOGUE_THRESHOLD_MS = 90_000;

/**
 * Minimum elapsed-time floor for WPM (15s). Below this the per-minute
 * extrapolation is too noisy to be useful. The selector also gates on
 * sample size (20 words) so this is a belt-and-suspenders guard for
 * very fast talkers in the first few seconds.
 */
export const MIN_WPM_ELAPSED_MS = 15_000;

const emptyStats = (): SpeakerStats => ({
  totalWords: 0,
  totalSpeakingTimeMs: 0,
  lastSpokeAt: null,
});

/**
 * Cheap word counter — splits on whitespace and discards empties. Good
 * enough for English + Spanish. Doesn't try to normalise contractions
 * or punctuation; matches what a human would intuitively count.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  sessionStartedAt: null,
  you: emptyStats(),
  them: emptyStats(),
  monologueStartedAt: null,
  isMonologueAlert: false,
  monologueLastTickMs: 0,

  startSession: () =>
    set({
      sessionStartedAt: Date.now(),
      you: emptyStats(),
      them: emptyStats(),
      monologueStartedAt: null,
      isMonologueAlert: false,
      monologueLastTickMs: 0,
    }),

  recordTranscript: ({ side, text, timestamp, isFinal }) => {
    // Only count FINAL transcripts. Interim transcripts are by design
    // mutable (Deepgram refines them in place) so counting them would
    // double-count words once the final lands.
    if (!isFinal) return;
    const words = countWords(text);
    if (words === 0) return;

    set((state) => {
      const sideStats: SpeakerStats = {
        ...state[side],
        totalWords: state[side].totalWords + words,
        lastSpokeAt: timestamp,
      };

      // Monologue tracking: "them" speaking resets the run. "you"
      // speaking starts the run if it isn't already running — we
      // never reset it just because YOU said another sentence.
      let monologueStartedAt = state.monologueStartedAt;
      let isMonologueAlert = state.isMonologueAlert;
      if (side === "them") {
        monologueStartedAt = null;
        isMonologueAlert = false;
      } else if (monologueStartedAt === null) {
        monologueStartedAt = timestamp;
      }

      return {
        ...state,
        [side]: sideStats,
        monologueStartedAt,
        isMonologueAlert,
      };
    });
  },

  tick: () => {
    set((state) => {
      if (state.monologueStartedAt === null) {
        if (!state.isMonologueAlert && state.monologueLastTickMs === 0) {
          return state;
        }
        return { ...state, isMonologueAlert: false, monologueLastTickMs: 0 };
      }
      const now = Date.now();
      const elapsed = now - state.monologueStartedAt;
      const next = elapsed >= MONOLOGUE_THRESHOLD_MS;
      return {
        ...state,
        isMonologueAlert: next,
        // Snap to whole seconds so subscribers only re-render once per
        // second of monologue, not on every tick that happens to land
        // a few ms apart in the same wall-clock second.
        monologueLastTickMs: Math.floor(now / 1000) * 1000,
      };
    });
  },

  reset: () =>
    set({
      sessionStartedAt: null,
      you: emptyStats(),
      them: emptyStats(),
      monologueStartedAt: null,
      isMonologueAlert: false,
      monologueLastTickMs: 0,
    }),
}));
