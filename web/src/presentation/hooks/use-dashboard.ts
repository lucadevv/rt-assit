"use client";

/**
 * useDashboard — single-call hook that powers the F4 Home dashboard.
 *
 * Combines two reads (Promise.all) so the dashboard renders once, not in
 * two waves:
 *   - getDashboardStats → DashboardStats (computed, current month)
 *   - listRecentSessions(5) → 5 most recent sessions
 *
 * State machine:
 *   loading=true (initial) → loading=false + data | loading=false + error.
 *
 * No store: dashboard is a single-page consumer. Local state keeps the
 * fetch isolated and lets us cancel cleanly on unmount.
 */

import { useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { DashboardStats } from "@/domain/entities/dashboard-stats";
import type { Session } from "@/domain/entities/session";

interface DashboardState {
  stats: DashboardStats | null;
  recentSessions: Session[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: DashboardState = {
  stats: null,
  recentSessions: [],
  loading: true,
  error: null,
};

export function useDashboard(): DashboardState {
  const { getDashboardStats, listRecentSessions } = useContainer();
  const [data, setData] = useState<DashboardState>(INITIAL_STATE);
  // StrictMode dedup: ensure the fetch only fires once per real mount,
  // not twice on the dev-only double-mount. We deliberately do NOT use a
  // `cancelled` closure inside the effect — combining it with `fetchedRef`
  // causes a stale-closure trap in dev StrictMode: the first mount sets
  // `cancelled=true` on cleanup, the second mount short-circuits via
  // `fetchedRef`, and the in-flight Promise.all then skips its setData
  // (because it sees the first closure's cancelled=true). The result was
  // a permanently stuck `loading=true` so the user never saw stats.
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    Promise.all([
      getDashboardStats.execute(),
      listRecentSessions.execute(5),
    ])
      .then(([stats, recentSessions]) => {
        setData({
          stats,
          recentSessions,
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setData({
          stats: null,
          recentSessions: [],
          loading: false,
          error: `No se pudo cargar el dashboard: ${msg}`,
        });
      });
  }, [getDashboardStats, listRecentSessions]);

  return data;
}
