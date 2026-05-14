"use client";

/**
 * useSessionsList — page-level hook for /app/sessions.
 *
 * Responsibilities:
 *  - Fetch up to 200 sessions (server-side ordered DESC by started_at).
 *  - Expose loading / error state + a `refresh()` callback for post-mutation
 *    flows (e.g. after deleting a session from the detail page and bouncing
 *    back to the list).
 *
 * Filtering by scenario / search is intentionally LEFT CLIENT-SIDE on this
 * page because the backend filter is single-scenario only and the list
 * page UI needs multi-select pill toggles. We trade a tiny payload tax for
 * a much richer filter UX. If the catalog grows past a few hundred items
 * per user we'll push the filter back to the server.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { Session } from "@/domain/entities/session";

interface UseSessionsListResult {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_LIMIT = 200;

export function useSessionsList(): UseSessionsListResult {
  const { listSessions } = useContainer();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const items = await listSessions.execute({
        limit: DEFAULT_LIMIT,
        offset: 0,
      });
      setSessions(items);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos cargar tus sesiones.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [listSessions]);

  // StrictMode dedup — fetch exactly once per real mount.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
