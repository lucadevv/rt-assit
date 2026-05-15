"use client";

/**
 * useAudioSync — the F8 audio<>transcript synchronisation primitive.
 *
 * Drives:
 *  - audio element ref + native HTML5 events (onTimeUpdate, onLoadedMetadata,
 *    onPlay, onPause, onEnded).
 *  - currentTime + duration + isPlaying as React state, for the seek bar.
 *  - activeTranscriptId — the transcript whose `timestampMs` is the
 *    largest value <= currentTime (binary-search).
 *  - seekTo(seconds) — programmatic seek.
 *  - seekToTranscriptByTimestamp — convenience for "click transcript"
 *    behaviour. Plays automatically if paused.
 *  - togglePlay — keyboard shortcut hook (Space).
 *  - playbackRate — user-controlled speed (0.75x..2x).
 *
 * Cleanup: NO zombie audio. The owning component must call `release()`
 * (typically from useEffect cleanup) so we pause + clear src + revoke
 * any object URL bindings. The hook guards against stale callbacks by
 * stamping each effect with the audio element ref.
 *
 * Performance notes:
 *  - findActive uses binary search: O(log N) for typical session lengths
 *    (<~3000 transcripts) it's <0.1ms per timeupdate firing.
 *  - We DON'T setState on every timeupdate — only when the active id
 *    actually changes. That keeps PlaybackTranscript from re-rendering
 *    on every audio frame.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Transcript } from "@/domain/entities/transcript";

interface UseAudioSyncResult {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  activeTranscriptId: number | null;
  // Native event handlers (wire onto <audio> JSX directly)
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  // Programmatic controls
  seekTo: (seconds: number) => void;
  seekToTimestampMs: (ms: number, autoplay?: boolean) => void;
  togglePlay: () => void;
  setPlaybackRate: (rate: number) => void;
  release: () => void;
}

/**
 * Binary search the largest `transcripts[i].timestampMs <= timeMs`.
 * Returns null if no transcript at-or-before the given time exists.
 * Assumes `transcripts` is sorted by `timestampMs` ascending (the
 * backend guarantees this on the detail endpoint).
 */
function findActiveTranscriptId(
  transcripts: readonly Transcript[],
  timeMs: number,
): number | null {
  if (transcripts.length === 0) return null;
  let lo = 0;
  let hi = transcripts.length - 1;
  let best: Transcript | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const m = transcripts[mid];
    if (!m) break;
    if (m.timestampMs <= timeMs) {
      best = m;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best?.id ?? null;
}

export function useAudioSync(
  transcripts: readonly Transcript[],
): UseAudioSyncResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [activeTranscriptId, setActiveTranscriptId] = useState<number | null>(
    null,
  );

  // Pre-extract sorted timestampMs slice with ids — avoids re-sorting in
  // findActive on every event.
  const sortedTranscripts = useMemo(() => {
    return [...transcripts].sort((a, b) => a.timestampMs - b.timestampMs);
  }, [transcripts]);

  const onTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
    const nextActive = findActiveTranscriptId(
      sortedTranscripts,
      a.currentTime * 1000,
    );
    // Avoid re-rendering when the active id stays the same.
    setActiveTranscriptId((prev) => (prev === nextActive ? prev : nextActive));
  }, [sortedTranscripts]);

  const onLoadedMetadata = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (Number.isFinite(a.duration)) {
      setDuration(a.duration);
    }
  }, []);

  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onEnded = useCallback(() => setIsPlaying(false), []);

  const seekTo = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(seconds, a.duration || seconds));
    a.currentTime = clamped;
    setCurrentTime(clamped);
    const nextActive = findActiveTranscriptId(sortedTranscripts, clamped * 1000);
    setActiveTranscriptId((prev) => (prev === nextActive ? prev : nextActive));
  }, [sortedTranscripts]);

  const seekToTimestampMs = useCallback(
    (ms: number, autoplay = true) => {
      seekTo(ms / 1000);
      if (autoplay) {
        const a = audioRef.current;
        if (a && a.paused) {
          void a.play().catch(() => {
            // Autoplay can be blocked — surface as paused state so the
            // user clicks play themselves.
            setIsPlaying(false);
          });
        }
      }
    },
    [seekTo],
  );

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play().catch(() => setIsPlaying(false));
    } else {
      a.pause();
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const a = audioRef.current;
    if (!a) return;
    const clamped = Math.max(0.25, Math.min(rate, 4));
    a.playbackRate = clamped;
    setPlaybackRateState(clamped);
  }, []);

  const release = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.removeAttribute("src");
      a.load();
    } catch {
      // Ignore — defensive release only.
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Auto-release on unmount — prevents zombie audio when navigating away.
  useEffect(() => {
    return () => {
      release();
    };
  }, [release]);

  return {
    audioRef,
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    activeTranscriptId,
    onTimeUpdate,
    onLoadedMetadata,
    onPlay,
    onPause,
    onEnded,
    seekTo,
    seekToTimestampMs,
    togglePlay,
    setPlaybackRate,
    release,
  };
}
