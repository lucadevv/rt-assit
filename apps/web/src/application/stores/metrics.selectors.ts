/**
 * Metrics selectors — derived values for the live coaching panel.
 *
 * Kept separate from the store so the store stays focused on state
 * transitions while the UI consumes ergonomic, memoised reads.
 *
 * IMPORTANT — re-render budget:
 *   These selectors read primitive scalars (numbers / nullable numbers)
 *   from the store. Zustand uses Object.is equality, so they only
 *   re-render the consuming component when the underlying value
 *   actually changes. WPM updates at most once per tick (1s) because
 *   `Date.now()` is captured inside the selector body and bound to the
 *   subscription via `sessionStartedAt`/`totalWords` — see `useYouWpm`
 *   for the exact wiring.
 */

import { useMetricsStore } from "./metrics.store";

/**
 * Below this many "you" words we don't render a WPM number. Early
 * samples are too noisy to be useful and a flicker between e.g. 240 and
 * 80 in the first 10 seconds is more distracting than informative.
 */
const MIN_SAMPLE_WORDS = 20;

export interface TalkRatio {
  /** Rounded percent of words spoken by the user (0–100). */
  youPercent: number;
  /** Rounded percent of words spoken by the other side (0–100). */
  themPercent: number;
  /** Total words counted across both sides. 0 means "no data yet". */
  total: number;
}

/**
 * Talk ratio — % of words spoken by each side. Returns zero ratios with
 * `total === 0` until the first final transcript arrives so callers
 * can render a "no data" branch without conditional hooks.
 *
 * Rounding: each side is independently rounded to the nearest integer.
 * The two values may sum to 99 or 101 in edge cases (e.g. 33.5 / 66.5);
 * the UI handles this by treating the two as independent visual widths
 * rather than enforcing a strict sum.
 */
export function useTalkRatio(): TalkRatio {
  const youWords = useMetricsStore((s) => s.you.totalWords);
  const themWords = useMetricsStore((s) => s.them.totalWords);
  const total = youWords + themWords;
  if (total === 0) return { youPercent: 0, themPercent: 0, total: 0 };
  return {
    youPercent: Math.round((youWords / total) * 100),
    themPercent: Math.round((themWords / total) * 100),
    total,
  };
}

/**
 * WPM for the user — null until we have enough sample.
 *
 * Approximation: `words / elapsed minutes since session started`. This
 * underestimates real speaking pace (we divide by total wall clock,
 * not pure speaking time) but it's a stable, monotonic signal good
 * enough for "are you talking too fast?" coaching. Pure speaking-time
 * math requires VAD which we don't have client-side.
 *
 * Refresh model: this selector only re-runs when `youWords` or
 * `startedAt` change identity. During silence (no new finals) the
 * displayed value stays put — which is the right UX, since "pace"
 * during silence is meaningless and a number that drifts downward
 * every second would just be noise. New words land → fresh WPM.
 *
 * Returns null when:
 *   - session hasn't started, OR
 *   - we have fewer than 20 words from the user, OR
 *   - elapsed < 15s (avoid wild extrapolation early).
 */
export function useYouWpm(): number | null {
  const youWords = useMetricsStore((s) => s.you.totalWords);
  const startedAt = useMetricsStore((s) => s.sessionStartedAt);
  if (startedAt === null) return null;
  if (youWords < MIN_SAMPLE_WORDS) return null;
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs < 15_000) return null;
  const elapsedMinutes = elapsedMs / 60_000;
  return Math.round(youWords / elapsedMinutes);
}

/**
 * Boolean: is the user currently in a monologue (>=90s without "them"
 * interjecting)? Updates via the metrics store's `tick` interval.
 */
export function useMonologueAlert(): boolean {
  return useMetricsStore((s) => s.isMonologueAlert);
}

/**
 * Seconds elapsed since the current monologue started. Null when no
 * monologue run is active.
 *
 * Subscribes to `monologueLastTickMs` (updated once per second by the
 * store's `tick` action while a monologue is active) so the displayed
 * counter increments smoothly without us having to keep local React
 * state on the consumer.
 */
export function useMonologueDurationSec(): number | null {
  const startedAt = useMetricsStore((s) => s.monologueStartedAt);
  const lastTick = useMetricsStore((s) => s.monologueLastTickMs);
  if (startedAt === null) return null;
  // Use the tick snapshot when available (post-first-tick) so we don't
  // pay a `Date.now()` per render; fall back to a fresh read for the
  // first frame after `recordTranscript` set `monologueStartedAt` but
  // before the next tick lands.
  const reference = lastTick > 0 ? lastTick : Date.now();
  return Math.max(0, Math.floor((reference - startedAt) / 1000));
}
