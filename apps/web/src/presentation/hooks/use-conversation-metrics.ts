"use client";

/**
 * useConversationMetrics — bridges the session transcript stream into
 * the live coaching metrics store.
 *
 * Why a hook (not a store-to-store subscription):
 *   The mapping from `Transcript.deepgramSpeaker` → "you" | "them"
 *   depends on the `Speaker.isUser` flag, which lives in the session
 *   store's `speakers` Map. The flag may not be present when the first
 *   transcripts arrive (the backend reconciles diarization a few
 *   utterances in via `speaker_label_updated`). A hook can subscribe to
 *   BOTH `transcripts` and `speakers` and re-run cheaply when either
 *   changes — pure store wiring would either need cross-store coupling
 *   or buffer-and-replay logic.
 *
 * Lifecycle:
 *   - Mount on /app/live (top-level, alongside useLiveSession).
 *   - On `isCapturing` transitioning false→true → `startSession()` so
 *     the metrics clock starts at the same wall-clock moment as the
 *     audio capture.
 *   - On `isCapturing` true→false → `reset()` so the next session
 *     starts clean. (We reset on STOP rather than on START so the
 *     post-session card — if added later — could still read the final
 *     ratios.)
 *   - On every new final transcript that we haven't seen yet → resolve
 *     the side via the speakers Map and record it.
 *   - Every 1s → `tick()` so the monologue alert can fire even during
 *     pure silence (the dangerous interview case).
 *
 * Last-seen index strategy:
 *   We track how many final transcripts we've forwarded via a ref. When
 *   the session store appends new finals (always at the end of the
 *   array), we forward the delta. Resets to 0 on `reset()`.
 *
 * Speaker resolution fallback:
 *   When `Speaker.isUser` isn't known yet (the backend hasn't
 *   reconciled this cluster), we conservatively assume "them" — we'd
 *   rather miss a few user-side words than falsely flag a monologue.
 *   Once the backend reconciles and emits `speaker_label_updated`, the
 *   speakers Map updates and subsequent transcripts route correctly.
 */

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/application/stores/session.store";
import {
  useMetricsStore,
  type ConversationSide,
} from "@/application/stores/metrics.store";
import type { Transcript } from "@/domain/entities/transcript";
import type { Speaker } from "@/domain/entities/speaker";

function transcriptSpeakerKey(t: Transcript): number | null {
  return t.deepgramSpeaker ?? t.speakerId ?? null;
}

function resolveSide(
  transcript: Transcript,
  speakers: Map<number, Speaker>,
): ConversationSide {
  const key = transcriptSpeakerKey(transcript);
  if (key === null) return "them"; // safe default — see fallback note above
  const speaker = speakers.get(key);
  if (!speaker) return "them";
  return speaker.isUser ? "you" : "them";
}

export function useConversationMetrics(): void {
  const isCapturing = useSessionStore((s) => s.isCapturing);
  const transcripts = useSessionStore((s) => s.transcripts);
  const speakers = useSessionStore((s) => s.speakers);

  // Tracks how many finals we've already forwarded into the metrics
  // store, so re-renders (which include re-running this effect) don't
  // re-count old transcripts. Reset to 0 on session start.
  const forwardedCountRef = useRef(0);

  // -----------------------------------------------------------------
  // Session lifecycle — start metrics when capture starts, reset when
  // capture stops. We use a previous-value ref so we only trigger on
  // edges (false→true or true→false), not on every render.
  // -----------------------------------------------------------------
  const prevCapturingRef = useRef(false);
  useEffect(() => {
    const wasCapturing = prevCapturingRef.current;
    prevCapturingRef.current = isCapturing;
    if (!wasCapturing && isCapturing) {
      // Edge: capture just started. Start the metrics clock.
      forwardedCountRef.current = 0;
      useMetricsStore.getState().startSession();
      return;
    }
    if (wasCapturing && !isCapturing) {
      // Edge: capture just stopped. Reset so the next session is clean.
      forwardedCountRef.current = 0;
      useMetricsStore.getState().reset();
    }
  }, [isCapturing]);

  // -----------------------------------------------------------------
  // Forward new final transcripts into the metrics store.
  //
  // The session store appends finals to the end of the array, so the
  // delta is `transcripts.slice(forwardedCountRef.current)`. We only
  // forward `isFinal` rows (interim is the mutable slot we never count
  // — the store also guards this defensively).
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!isCapturing) return;
    const start = forwardedCountRef.current;
    if (transcripts.length <= start) return;
    const recordTranscript = useMetricsStore.getState().recordTranscript;
    for (let i = start; i < transcripts.length; i++) {
      const t = transcripts[i];
      if (!t) continue;
      if (!t.isFinal) continue;
      const side = resolveSide(t, speakers);
      recordTranscript({
        side,
        text: t.content,
        timestamp: t.timestampMs > 0 ? t.timestampMs : Date.now(),
        isFinal: true,
      });
    }
    forwardedCountRef.current = transcripts.length;
  }, [isCapturing, transcripts, speakers]);

  // -----------------------------------------------------------------
  // Tick — drives the monologue alert. Cheap: a single Date.now() diff
  // and an equality check inside the store; no React re-render unless
  // `isMonologueAlert` actually flips.
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!isCapturing) return;
    const tick = useMetricsStore.getState().tick;
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [isCapturing]);
}
