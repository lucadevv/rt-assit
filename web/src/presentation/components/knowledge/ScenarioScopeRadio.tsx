"use client";

/**
 * ScenarioScopeRadio — radio group that decides whether the upload is
 * tied to the current scenario or kept global (FR-38).
 *
 * UI rule:
 *  - "global" → scenario = null
 *  - "scenario" → scenario = currentScenarioId (must be non-null)
 *
 * If the doc type is global-only (cv/profile/reference) the radio is
 * disabled and forces "global". If the doc type is scenario-scoped
 * (job_offer/meeting_brief/etc.) and the user has no current scenario
 * yet, the control falls back to "global" with a helper message.
 */

import type { JSX } from "react";
import {
  isGlobalOnlyDocType,
  type DocType,
  SCENARIO_SCOPED_DOC_TYPES,
} from "@/domain/entities/document";

export type ScenarioScopeValue = "global" | "scenario";

interface ScenarioScopeRadioProps {
  value: ScenarioScopeValue;
  onChange: (next: ScenarioScopeValue) => void;
  docType: DocType;
  currentScenarioId: string | null;
  currentScenarioLabel: string | null;
  idPrefix: string;
}

const baseLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

export function ScenarioScopeRadio({
  value,
  onChange,
  docType,
  currentScenarioId,
  currentScenarioLabel,
  idPrefix,
}: ScenarioScopeRadioProps): JSX.Element {
  const globalOnly = isGlobalOnlyDocType(docType);
  const isScenarioScoped = (
    SCENARIO_SCOPED_DOC_TYPES as readonly DocType[]
  ).includes(docType);
  const noScenarioAvailable = currentScenarioId == null;

  const effectiveValue: ScenarioScopeValue = globalOnly
    ? "global"
    : noScenarioAvailable
      ? "global"
      : value;

  const scenarioId = `${idPrefix}-scope-scenario`;
  const globalId = `${idPrefix}-scope-global`;

  return (
    <fieldset
      style={{
        border: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <legend
        className="mono"
        style={{
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: "0.6px",
          color: "var(--color-text-mid)",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Alcance
      </legend>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label
          htmlFor={globalId}
          style={{
            ...baseLabelStyle,
            background:
              effectiveValue === "global"
                ? "var(--color-bg-soft)"
                : "transparent",
            borderColor:
              effectiveValue === "global"
                ? "var(--color-text)"
                : "var(--color-border)",
            opacity: 1,
          }}
        >
          <input
            id={globalId}
            type="radio"
            name={`${idPrefix}-scope`}
            value="global"
            checked={effectiveValue === "global"}
            onChange={() => onChange("global")}
          />
          Global (todos los escenarios)
        </label>
        <label
          htmlFor={scenarioId}
          style={{
            ...baseLabelStyle,
            background:
              effectiveValue === "scenario"
                ? "var(--color-bg-soft)"
                : "transparent",
            borderColor:
              effectiveValue === "scenario"
                ? "var(--color-text)"
                : "var(--color-border)",
            opacity: globalOnly || noScenarioAvailable ? 0.55 : 1,
            cursor:
              globalOnly || noScenarioAvailable ? "not-allowed" : "pointer",
          }}
        >
          <input
            id={scenarioId}
            type="radio"
            name={`${idPrefix}-scope`}
            value="scenario"
            checked={effectiveValue === "scenario"}
            disabled={globalOnly || noScenarioAvailable}
            onChange={() => onChange("scenario")}
          />
          Solo escenario actual
          {currentScenarioLabel ? ` (${currentScenarioLabel})` : ""}
        </label>
      </div>
      {globalOnly ? (
        <span style={{ fontSize: 12, color: "var(--color-text-mid)" }}>
          Este tipo de documento siempre es global y aplica a todos los
          escenarios.
        </span>
      ) : null}
      {!globalOnly && noScenarioAvailable ? (
        <span style={{ fontSize: 12, color: "var(--color-text-mid)" }}>
          No hay un escenario activo seleccionado en la barra superior. Vamos
          a guardarlo como global.
        </span>
      ) : null}
      {!globalOnly &&
      !noScenarioAvailable &&
      isScenarioScoped &&
      effectiveValue === "global" ? (
        <span style={{ fontSize: 12, color: "var(--color-text-mid)" }}>
          Sugerencia: este tipo suele ir atado a un escenario.
        </span>
      ) : null}
    </fieldset>
  );
}
