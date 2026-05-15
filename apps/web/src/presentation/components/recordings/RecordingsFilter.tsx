"use client";

/**
 * RecordingsFilter — search box + scenario dropdown for the list.
 *
 * Uses F0 Input + Select primitives to stay on-system. Filter results
 * are computed by the page (so we keep this stateless + cheap).
 */

import type { JSX } from "react";
import { Input, Select } from "@/design-system/primitives";

interface RecordingsFilterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  scenarioFilter: string | null;
  onScenarioChange: (scenarioId: string | null) => void;
  /** Distinct list of scenarios present in the loaded recordings. */
  availableScenarios: string[];
  total: number;
  filtered: number;
}

const SCENARIO_LABELS: Record<string, string> = {
  interview_dev: "Entrevista",
  meeting_business: "Reunión",
  sales_call: "Venta",
  exam_oral: "Examen oral",
  personal: "Personal",
};

function labelFor(id: string): string {
  return SCENARIO_LABELS[id] ?? id;
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-mid)",
  margin: "0 0 6px",
  letterSpacing: "0.4px",
  textTransform: "uppercase" as const,
};

export function RecordingsFilter({
  searchQuery,
  onSearchChange,
  scenarioFilter,
  onScenarioChange,
  availableScenarios,
  total,
  filtered,
}: RecordingsFilterProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <label htmlFor="rec-search" style={labelStyle}>
          Buscar
        </label>
        <Input
          id="rec-search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por título o escenario…"
          aria-label="Buscar grabaciones"
        />
      </div>
      <div style={{ minWidth: 180 }}>
        <label htmlFor="rec-scenario" style={labelStyle}>
          Escenario
        </label>
        <Select
          id="rec-scenario"
          value={scenarioFilter ?? ""}
          onChange={(e) =>
            onScenarioChange(e.target.value === "" ? null : e.target.value)
          }
        >
          <option value="">Todos</option>
          {availableScenarios.map((s) => (
            <option key={s} value={s}>
              {labelFor(s)}
            </option>
          ))}
        </Select>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "var(--color-text-dim)",
          padding: "0 4px 10px",
        }}
      >
        {filtered === total
          ? `${total} grabaciones`
          : `${filtered} de ${total}`}
      </p>
    </div>
  );
}
