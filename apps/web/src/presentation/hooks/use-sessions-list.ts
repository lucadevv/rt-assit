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

import { useCallback, useEffect, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
import type { Session } from "@/domain/entities/session";

interface UseSessionsListResult {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_LIMIT = 200;
const SESSIONS_LIST_STALE_MS = 30_000;

// Module-scope dedup state — there's no Zustand store for the sessions
// list (data lives in local React state), so we use a module singleton.
// Module scope survives HMR remount the same way Zustand does.
let sessionsListLastFetchedAt: number | null = null;

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

  // Gate fetch on authenticated user (single source of truth = auth store).
  // Without this, the hook fires before the layout's auth gate redirects
  // and the backend responds 401, dirtying the console.
  const isAuthed = useAuthStore((s) => s.user !== null);

  useEffect(() => {
    if (!isAuthed) return;
    if (
      sessionsListLastFetchedAt !== null &&
      Date.now() - sessionsListLastFetchedAt < SESSIONS_LIST_STALE_MS
    ) {
      return;
    }
    sessionsListLastFetchedAt = Date.now();
    void refresh().catch(() => {
      // Roll back so a retry can happen sooner than the stale window.
      sessionsListLastFetchedAt = null;
    });
  }, [isAuthed, refresh]);

  return { sessions, loading, error, refresh };
}
