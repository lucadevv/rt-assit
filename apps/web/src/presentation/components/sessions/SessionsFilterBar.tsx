"use client";

/**
 * SessionsFilterBar — search + scenario pills + date range pills.
 *
 * Scenario filter is multi-select (clicking a pill toggles its inclusion
 * in the set). Date filter is single-select with 4 buckets:
 *   "Todas" (default) | "Hoy" | "Última semana" | "Último mes"
 *
 * The list page owns the filter state and passes it down — this component
 * is stateless to keep the URL/state plumbing flexible (a future iteration
 * can lift it into search params).
 */

import type { JSX } from "react";
import { Input, Pill } from "@/design-system/primitives";
import type { Scenario } from "@/domain/entities/scenario";
import { scenarioColorOf } from "@/domain/entities/scenario";

export type DateBucket = "all" | "today" | "week" | "month";

interface SessionsFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedScenarios: ReadonlySet<string>;
  onToggleScenario: (scenarioId: string) => void;
  scenarios: Scenario[];
  dateBucket: DateBucket;
  onDateBucketChange: (bucket: DateBucket) => void;
  total: number;
  filtered: number;
}

const DATE_LABEL: Record<DateBucket, string> = {
  all: "Todas",
  today: "Hoy",
  week: "Última semana",
  month: "Último mes",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-mid)",
  margin: "0 0 8px",
  letterSpacing: "0.4px",
  textTransform: "uppercase" as const,
};

export function SessionsFilterBar({
  searchQuery,
  onSearchChange,
  selectedScenarios,
  onToggleScenario,
  scenarios,
  dateBucket,
  onDateBucketChange,
  total,
  filtered,
}: SessionsFilterBarProps): JSX.Element {
  const buckets: DateBucket[] = ["all", "today", "week", "month"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <label htmlFor="sessions-search" style={labelStyle}>
          Buscar por título
        </label>
        <Input
          id="sessions-search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar sesiones por título…"
          aria-label="Buscar sesiones"
        />
      </div>

      <div>
        <span style={labelStyle}>Escenarios</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {scenarios.map((s) => {
            const active = selectedScenarios.has(s.id);
            const color = scenarioColorOf(s);
            return (
              <Pill
                key={s.id}
                asElement="button"
                variant={active ? color : "ghost"}
                onClick={() => onToggleScenario(s.id)}
                title={active ? `Quitar ${s.label}` : `Filtrar por ${s.label}`}
              >
                {s.label}
              </Pill>
            );
          })}
        </div>
      </div>

      <div>
        <span style={labelStyle}>Rango</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {buckets.map((b) => {
            const active = dateBucket === b;
            return (
              <Pill
                key={b}
                asElement="button"
                variant={active ? "dark" : "ghost"}
                onClick={() => onDateBucketChange(b)}
              >
                {DATE_LABEL[b]}
              </Pill>
            );
          })}
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "var(--color-text-dim)",
        }}
      >
        {filtered === total ? `${total} sesiones` : `${filtered} de ${total}`}
      </p>
    </div>
  );
}
