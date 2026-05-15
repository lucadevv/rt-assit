"use client";

/**
 * useRecordingPlayback — loads playback aggregate (Session detail +
 * Recording metadata + signed audio URL) for a given sessionId.
 *
 * Behaviour:
 *  - Re-fetches whenever `sessionId` changes (so navigating between
 *    recordings refreshes cleanly).
 *  - Exposes a `refresh()` for post-mutation flows (e.g. after
 *    "regenerate summary" the page polls back to observe the new summary).
 *  - The signed `audioUrl` has a hard expiry (~1h). The hook re-fetches
 *    the URL automatically when the existing one is within 30s of expiry
 *    AND the user is still on the page — keeps long-running playback
 *    sessions from breaking mid-listen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { RecordingPlayback } from "@/domain/entities/recording-playback";

interface UseRecordingPlaybackResult {
  playback: RecordingPlayback | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Re-fetch the signed URL only (keeps transcripts intact). */
  refreshSignedUrl: () => Promise<void>;
}

const URL_REFRESH_LEAD_MS = 30 * 1000;

export function useRecordingPlayback(
  sessionId: string | null,
): UseRecordingPlaybackResult {
  const { getRecordingPlayback, recordingsApi } = useContainer();
  const [playback, setPlayback] = useState<RecordingPlayback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      setPlayback(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getRecordingPlayback.execute(sessionId);
      setPlayback(result);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cargar la grabación.";
      setError(msg);
      setPlayback(null);
    } finally {
      setLoading(false);
    }
  }, [getRecordingPlayback, sessionId]);

  const refreshSignedUrl = useCallback(async (): Promise<void> => {
    if (!sessionId || !playback) return;
    try {
      const signed = await recordingsApi.getSignedUrl(sessionId);
      setPlayback({
        ...playback,
        audioUrl: signed.url,
        audioUrlExpiresAt: Date.now() + signed.expiresSeconds * 1000,
      });
    } catch {
      // Best-effort — leave the existing URL in place; the audio element
      // will surface a play error if the user attempts seek after expiry.
    }
  }, [recordingsApi, sessionId, playback]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh the signed URL ~30s before it expires.
  useEffect(() => {
    if (!playback) return;
    const ms = playback.audioUrlExpiresAt - Date.now() - URL_REFRESH_LEAD_MS;
    if (ms <= 0) return;
    const id = window.setTimeout(() => {
      void refreshSignedUrl();
    }, ms);
    refreshTimerRef.current = id;
    return () => {
      window.clearTimeout(id);
    };
  }, [playback, refreshSignedUrl]);

  return { playback, loading, error, refresh, refreshSignedUrl };
}
