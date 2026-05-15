"use client";

/**
 * useMyMeetings — page-level hook for /app/meetings.
 *
 * Loads the user's meetings on mount (StrictMode-deduped), exposes a
 * `refresh()` callback the page can call after creating / deleting one
 * elsewhere, and a `remove(id)` callback that mutates the store
 * optimistically (filters out the deleted id) before awaiting the API.
 *
 * Why not Zustand: the meetings list is page-scoped (only /app/meetings
 * needs it) and never broadcast across components, so local React state is
 * the right granularity — same pattern as `use-onboarding-status.ts`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { Meeting } from "@/domain/entities/meeting";

interface UseMyMeetingsResult {
  meetings: Meeting[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  refresh: () => Promise<void>;
  remove: (meetingId: string) => Promise<void>;
}

export function useMyMeetings(): UseMyMeetingsResult {
  const { listMyMeetings, deleteMeeting } = useContainer();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMyMeetings.execute();
      setMeetings(list);
      setHasFetched(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos cargar las reuniones.";
      setError(msg);
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [listMyMeetings]);

  const remove = useCallback(
    async (meetingId: string): Promise<void> => {
      // Optimistic: filter the list before the API resolves. Re-fetch on
      // failure to roll back from authoritative state.
      const prev = meetings;
      setMeetings((current) => current.filter((m) => m.id !== meetingId));
      try {
        await deleteMeeting.execute(meetingId);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "No pudimos eliminar la reunión.";
        setError(msg);
        setMeetings(prev);
        throw err;
      }
    },
    [deleteMeeting, meetings],
  );

  // StrictMode dedup — same pattern as `use-integrations.ts`.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    if (!hasFetched && !loading) {
      fetchedRef.current = true;
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFetched]);

  return { meetings, loading, error, hasFetched, refresh, remove };
}
