"use client";

/**
 * useSessionDetail(sessionId) — page-level hook for /app/sessions/[id].
 *
 * Fetches the full `SessionDetail` (session + transcripts + hints +
 * speakers + tags) and exposes refresh/regenerate/delete callbacks the
 * detail page UI binds to its actions.
 *
 * Why a dedicated hook (vs reusing useRecordingPlayback): the recording
 * playback hook bundles the audio URL and is gated on `recordings` tier.
 * The sessions detail page works for ALL tiers — there's no audio
 * required — so we go straight to `getSessionDetail` and skip the
 * recording fetch entirely.
 *
 * Regenerate flow mirrors RecordingDetail: POST returns immediately, we
 * mark `regenerating=true`, then poll every 4s up to 60s. The detail is
 * re-fetched and once the summary changes we stop polling.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { SessionDetail } from "@/application/ports/sessions-api.port";

interface UseSessionDetailResult {
  detail: SessionDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  regenerating: boolean;
  regenerateError: string | null;
  regenerateSummary: () => Promise<void>;
  deleting: boolean;
  deleteError: string | null;
  deleteSession: () => Promise<boolean>;
}

const REGEN_POLL_INTERVAL_MS = 4000;
const REGEN_POLL_TIMEOUT_MS = 60_000;

export function useSessionDetail(
  sessionId: string | null,
): UseSessionDetailResult {
  const { getSessionDetail, regenerateSessionSummary, deleteSession } =
    useContainer();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const regenStartedAtRef = useRef<number | null>(null);
  const initialSummaryRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionDetail.execute(sessionId);
      setDetail(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos cargar la sesión.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getSessionDetail, sessionId]);

  // Initial fetch — re-run when sessionId changes.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Regenerate summary — fire-and-poll.
  const regenerateSummary = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    setRegenerateError(null);
    setRegenerating(true);
    regenStartedAtRef.current = Date.now();
    initialSummaryRef.current = detail?.session.summary ?? null;
    try {
      await regenerateSessionSummary.execute(sessionId);
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos regenerar el resumen.";
      setRegenerateError(msg);
      setRegenerating(false);
    }
  }, [regenerateSessionSummary, refresh, sessionId, detail?.session.summary]);

  // Poll until summary changes or timeout.
  useEffect(() => {
    if (!regenerating) return;
    const id = window.setInterval(() => {
      const start = regenStartedAtRef.current ?? Date.now();
      const elapsed = Date.now() - start;
      if (elapsed > REGEN_POLL_TIMEOUT_MS) {
        setRegenerating(false);
        setRegenerateError(
          "La regeneración está tardando más de lo normal. Probá refrescar en un momento.",
        );
        window.clearInterval(id);
        return;
      }
      void refresh();
      const currentSummary = detail?.session.summary ?? null;
      const initial = initialSummaryRef.current;
      if (
        currentSummary !== null &&
        currentSummary !== initial &&
        currentSummary !== ""
      ) {
        setRegenerating(false);
        window.clearInterval(id);
      }
    }, REGEN_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [regenerating, refresh, detail?.session.summary]);

  const handleDelete = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;
    setDeleting(true);
    setDeleteError(null);
    try {
      const ok = await deleteSession.execute(sessionId);
      return ok;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos eliminar la sesión.";
      setDeleteError(msg);
      return false;
    } finally {
      setDeleting(false);
    }
  }, [deleteSession, sessionId]);

  return {
    detail,
    loading,
    error,
    refresh,
    regenerating,
    regenerateError,
    regenerateSummary,
    deleting,
    deleteError,
    deleteSession: handleDelete,
  };
}
