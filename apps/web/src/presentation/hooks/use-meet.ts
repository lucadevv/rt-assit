"use client";

/**
 * useMeet — thin hook that exposes the `CreateMeetMeetingUseCase` to UI
 * components with a tracked loading / error state.
 *
 * UI usage (Sprint 1):
 *   const { createMeeting, loading, error } = useMeet();
 *   const meeting = await createMeeting("Onboarding call");
 *   // navigator.clipboard.writeText(meeting.joinUrl);
 *
 * Errors surface verbatim (Spanish messages set by the caller); HTTP
 * status codes are not exposed here — the consuming component checks
 * `error` for known signatures (e.g. 412 / 401) or shows it as-is.
 */

import { useCallback, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { Meeting } from "@/domain/entities/meeting";

interface UseMeetResult {
  createMeeting: (title?: string) => Promise<Meeting>;
  loading: boolean;
  error: string | null;
}

export function useMeet(): UseMeetResult {
  const container = useContainer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMeeting = useCallback(
    async (title?: string): Promise<Meeting> => {
      setLoading(true);
      setError(null);
      try {
        return await container.createMeetMeeting.execute(title);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al crear reunión";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [container],
  );

  return { createMeeting, loading, error };
}
