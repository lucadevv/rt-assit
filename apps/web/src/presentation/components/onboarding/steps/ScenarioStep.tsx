"use client";

/**
 * ScenarioStep — Step 3/5. The user picks ONE default scenario from the
 * 4 dev-focused IDs (interview_dev, interview_behavioral, technical_call,
 * code_review).
 *
 * Why constrain to 4 and not the full catalog: PRODUCT.md positions
 * Susurra as the dev-LATAM interview copilot — the wedge audience. Other
 * scenarios live in the app but are out-of-scope for first-run. The
 * picker uses the established scenario→color brand convention
 * (`scenarioColorOf`) so the visual language is consistent with the
 * scenario picker in `NewSessionModal`.
 *
 * On select:
 *  - Visually flips the card (coral border + soft fill).
 *  - On "Continuar" we both report `defaultScenarioId` up to the wizard
 *    AND call `setCurrent(id)` so the rest of the app already reflects
 *    the choice (useScenarios store persists it to localStorage).
 */

import { useMemo, useState, type JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import {
  filterDevFocused,
  scenarioColorOf,
  type Scenario,
  type ScenarioColor,
} from "@/domain/entities/scenario";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { WizardNav } from "../WizardNav";

interface ScenarioStepProps {
  initialScenarioId: string | null;
  onNext: (scenarioId: string) => void;
  onBack: () => void;
}

const COLOR_RING: Record<ScenarioColor, string> = {
  cyan: "var(--color-cyan, #2EC4F1)",
  amber: "var(--color-amber, #F5A623)",
  lavender: "var(--color-lavender, #B59CE0)",
  lime: "var(--color-lime, #C7E04E)",
};

const COLOR_SOFT_BG: Record<ScenarioColor, string> = {
  cyan: "rgba(46, 196, 241, 0.10)",
  amber: "rgba(245, 166, 35, 0.10)",
  lavender: "rgba(181, 156, 224, 0.10)",
  lime: "rgba(199, 224, 78, 0.12)",
};

export function ScenarioStep({
  initialScenarioId,
  onNext,
  onBack,
}: ScenarioStepProps): JSX.Element {
  const { available, setCurrent } = useScenarios();
  const devScenarios = useMemo<Scenario[]>(
    () => filterDevFocused(available),
    [available],
  );

  // Default selection: the wizard's prior choice (if going Back/Forward),
  // or the first dev scenario as a sensible starting point.
  const [selected, setSelected] = useState<string | null>(() => {
    if (initialScenarioId) return initialScenarioId;
    return devScenarios[0]?.id ?? null;
  });

  const handleNext = (): void => {
    if (!selected) return;
    setCurrent(selected);
    onNext(selected);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        padded
        variant="soft"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <Pill variant="cyan">Paso 3</Pill>
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.6px",
          }}
        >
          Elegí tu scenario por defecto
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            lineHeight: 1.55,
          }}
        >
          Susurra adapta sus sugerencias al contexto. Empezá con el que
          más usás — siempre podés cambiarlo en cualquier sesión.
        </p>
      </Card>

      {devScenarios.length === 0 ? (
        <Card padded>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            No pudimos cargar los scenarios. Probá refrescar la página o
            volvé más tarde — podés terminar el onboarding cuando estén
            disponibles.
          </p>
        </Card>
      ) : (
        <div
          role="radiogroup"
          aria-label="Scenario por defecto"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {devScenarios.map((scenario) => {
            const isSelected = selected === scenario.id;
            const color = scenarioColorOf(scenario);
            const ring = COLOR_RING[color];
            const soft = COLOR_SOFT_BG[color];
            return (
              <button
                key={scenario.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(scenario.id)}
                style={{
                  appearance: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  background: isSelected ? soft : "var(--color-bg-soft)",
                  border: `2px solid ${
                    isSelected ? ring : "var(--color-border)"
                  }`,
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  transition:
                    "background 160ms cubic-bezier(0.23, 1, 0.32, 1), border-color 160ms cubic-bezier(0.23, 1, 0.32, 1)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-inter)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: ring,
                  }}
                  aria-hidden
                />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "-0.3px",
                  }}
                >
                  {scenario.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-mid)",
                    lineHeight: 1.5,
                  }}
                >
                  {scenario.description ?? scenarioFallbackCopy(scenario.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <WizardNav
        onBack={onBack}
        onNext={handleNext}
        nextDisabled={!selected}
        nextLabel="Continuar"
      />
    </div>
  );
}

/**
 * Default copy when the backend doesn't return a description — keeps the
 * cards informative even on stale builds. es-LATAM voseo.
 */
function scenarioFallbackCopy(id: string): string {
  switch (id) {
    case "interview_dev":
      return "Entrevista técnica con vivo de código y preguntas de sistema.";
    case "interview_behavioral":
      return "Entrevista de fit cultural y experiencia con tu historial.";
    case "technical_call":
      return "Llamada técnica con compañeros o clientes para alinear.";
    case "code_review":
      return "Revisión de código en vivo — defendé decisiones con argumentos.";
    default:
      return "Sesión técnica con contexto real.";
  }
}
