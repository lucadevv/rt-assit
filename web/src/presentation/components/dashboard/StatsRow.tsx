"use client";

/**
 * StatsRow — three Susurra StatCards summarising the user's month.
 *
 * Cards (left → right):
 *   1. Sesiones del mes (cyan)
 *   2. Duración total (lime)
 *   3. Escenario top (lavender) — falls back to "—" when no sessions yet.
 *
 * Pure presentational; receives `stats` from useDashboard and the scenario
 * catalog from useScenarios so we can render the human-readable label
 * (instead of the scenario id).
 */

import type { JSX } from "react";
import { StatCard } from "@/design-system/primitives";
import type { DashboardStats } from "@/domain/entities/dashboard-stats";
import type { Scenario } from "@/domain/entities/scenario";

interface StatsRowProps {
  stats: DashboardStats;
  scenarios: Scenario[];
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 min";
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 1) return `${totalSeconds}s`;
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function StatsRow({ stats, scenarios }: StatsRowProps): JSX.Element {
  const topScenarioLabel = stats.topScenarioId
    ? (scenarios.find((s) => s.id === stats.topScenarioId)?.label ??
      stats.topScenarioId)
    : "—";

  const topScenarioCaption =
    stats.topScenarioId && stats.topScenarioCount > 0
      ? `${stats.topScenarioCount} ${
          stats.topScenarioCount === 1 ? "sesión" : "sesiones"
        } este mes`
      : "Sin sesiones aún";

  return (
    <div
      role="list"
      aria-label="Estadísticas del mes"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
      }}
    >
      <div role="listitem">
        <StatCard
          tone="cyan"
          value={String(stats.sessionsThisMonth)}
          label="Sesiones del mes"
          caption={
            stats.sessionsThisMonth === 0
              ? "Empezá tu primera"
              : "Este mes calendario"
          }
        />
      </div>
      <div role="listitem">
        <StatCard
          tone="lime"
          value={formatDuration(stats.totalDurationSecondsThisMonth)}
          label="Duración total"
          caption={
            stats.totalDurationSecondsThisMonth === 0
              ? "Aún sin minutos"
              : "Sumando todas tus sesiones"
          }
        />
      </div>
      <div role="listitem">
        <StatCard
          tone="lavender"
          value={topScenarioLabel}
          label="Escenario top"
          caption={topScenarioCaption}
        />
      </div>
    </div>
  );
}
