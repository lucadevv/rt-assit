"use client";

/**
 * Recordings (/app/recordings) — F8 implementation.
 *
 * Two states sharing one route:
 *   - List view: when no `selectedSessionId` is set, render the search +
 *     filter + recordings grid (or empty state for Free tier / Pro w/ no
 *     recordings).
 *   - Detail view: when `selectedSessionId` is set, render
 *     `RecordingDetail` (audio player + synced transcript + share modal +
 *     regenerate summary).
 *
 * State-based detail (no nested routing) is intentional for MVP — we
 * keep the recordings list cached in state when navigating to detail
 * and back, avoiding a re-fetch round-trip. A future iteration can
 * promote the detail to `/app/recordings/[sessionId]` with the same
 * UI components.
 *
 * Tier gating: `useRecordings` already enforces the gate via
 * `useTierGate("recordings")`. Free tier sees `RecordingsEmptyState`
 * mode="upgrade" — no 403, no redirect, just an inline upgrade card.
 */

import { useMemo, useState, type JSX } from "react";
import { Pill, Spinner } from "@/design-system/primitives";
import { useRecordings } from "@/presentation/hooks/use-recordings";
import { RecordingsList } from "@/presentation/components/recordings/RecordingsList";
import { RecordingsFilter } from "@/presentation/components/recordings/RecordingsFilter";
import { RecordingsEmptyState } from "@/presentation/components/recordings/RecordingsEmptyState";
import { RecordingDetail } from "@/presentation/components/recordings/RecordingDetail";
import type { RecordingWithSession } from "@/domain/entities/recording";

function filterRecordings(
  list: RecordingWithSession[],
  query: string,
  scenario: string | null,
): RecordingWithSession[] {
  const q = query.trim().toLowerCase();
  return list.filter((r) => {
    if (scenario && r.sessionScenario !== scenario) return false;
    if (q.length > 0) {
      const haystack = `${r.sessionTitle ?? ""} ${r.sessionScenario}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export default function RecordingsPage(): JSX.Element {
  const { recordings, loading, error, refresh, tierGate } = useRecordings();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState<string | null>(null);

  const availableScenarios = useMemo(() => {
    const set = new Set<string>();
    for (const r of recordings) set.add(r.sessionScenario);
    return [...set].sort();
  }, [recordings]);

  const filtered = useMemo(
    () => filterRecordings(recordings, searchQuery, scenarioFilter),
    [recordings, searchQuery, scenarioFilter],
  );

  // Detail view
  if (selectedSessionId) {
    return (
      <div style={{ maxWidth: 1100 }}>
        <RecordingDetail
          sessionId={selectedSessionId}
          onBack={() => setSelectedSessionId(null)}
          onAfterDelete={async () => {
            setSelectedSessionId(null);
            await refresh();
          }}
        />
      </div>
    );
  }

  // List view
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1100,
      }}
    >
      <header>
        <Pill variant="ghost">Grabaciones</Pill>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "-1.4px",
            margin: "12px 0 8px",
          }}
        >
          Grabaciones
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-mid)",
            fontSize: 16,
            lineHeight: 1.5,
            maxWidth: 640,
          }}
        >
          Reproducí tus sesiones pasadas con el transcript sincronizado y
          compartilas con quien quieras.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
            padding: 12,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 24,
            color: "var(--color-text-mid)",
            fontSize: 14,
          }}
        >
          <Spinner size={18} />
          <span>Cargando grabaciones…</span>
        </div>
      ) : !tierGate.available ? (
        <RecordingsEmptyState
          mode="upgrade"
          requiredTier={tierGate.requiredTier ?? "pro"}
        />
      ) : recordings.length === 0 ? (
        <RecordingsEmptyState mode="empty" />
      ) : (
        <>
          <RecordingsFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            scenarioFilter={scenarioFilter}
            onScenarioChange={setScenarioFilter}
            availableScenarios={availableScenarios}
            total={recordings.length}
            filtered={filtered.length}
          />
          {filtered.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--color-text-mid)",
                padding: "12px 4px",
              }}
            >
              No hay grabaciones que coincidan con tu búsqueda.
            </p>
          ) : (
            <RecordingsList
              recordings={filtered}
              onSelect={setSelectedSessionId}
            />
          )}
        </>
      )}
    </div>
  );
}
