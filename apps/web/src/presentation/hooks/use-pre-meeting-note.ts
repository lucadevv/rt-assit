"use client";

/**
 * usePreMeetingNote — fetch the AI-generated prep attached to a session.
 *
 * Returns `null` when no note exists (the adapter swallows 404). Used by
 * the live page to surface the prep card in the sidebar. Lazy, single
 * fetch per sessionId — no Zustand store needed because the note is
 * immutable once generated for a given session.
 */

import { useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { PreMeetingNote } from "@/domain/entities/pre-meeting-note";

interface UsePreMeetingNoteResult {
  note: PreMeetingNote | null;
  loading: boolean;
  hasFetched: boolean;
  error: string | null;
}

export function usePreMeetingNote(
  sessionId: string | null,
): UsePreMeetingNoteResult {
  const { getPreMeetingNoteForSession } = useContainer();

  const [note, setNote] = useState<PreMeetingNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId) {
      fetchedRef.current = null;
      setNote(null);
      setHasFetched(false);
      setError(null);
      return;
    }
    if (fetchedRef.current === sessionId) return;
    fetchedRef.current = sessionId;

    let active = true;
    setLoading(true);
    setError(null);

    getPreMeetingNoteForSession
      .execute(sessionId)
      .then((result) => {
        if (!active) return;
        setNote(result);
        setHasFetched(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setHasFetched(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return (): void => {
      active = false;
    };
  }, [sessionId, getPreMeetingNoteForSession]);

  return { note, loading, hasFetched, error };
}
