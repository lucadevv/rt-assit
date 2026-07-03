"use client";

/**
 * PersonaCard — visual + action surface for a single persona on
 * `/app/personas`. Pure presentational: parent owns state.
 */

import type { CSSProperties, JSX } from "react";
import { Button, Pill } from "@/design-system/primitives";
import type { Persona } from "@/domain/entities/persona";
import { PERSONA_TONE_LABELS } from "@/domain/entities/persona";
import {
  PERSONA_ICONS,
  PersonaUser,
  type PersonaIconKey,
} from "@/design-system/primitives/icons/PersonaIcons";
import type { ScenarioColor } from "@/domain/entities/scenario";

interface PersonaCardProps {
  persona: Persona;
  scenarioLabel: string | null;
  scenarioColor: ScenarioColor | null;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
  onSetDefault: (persona: Persona) => void;
}

const SCENARIO_BG: Record<ScenarioColor, string> = {
  cyan: "color-mix(in oklab, var(--color-cyan) 18%, var(--color-bg))",
  amber: "color-mix(in oklab, var(--color-amber) 18%, var(--color-bg))",
  lavender: "color-mix(in oklab, var(--color-lavender) 18%, var(--color-bg))",
  lime: "color-mix(in oklab, var(--color-lime) 18%, var(--color-bg))",
};

const SCENARIO_BORDER: Record<ScenarioColor, string> = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
};

export function PersonaCard({
  persona,
  scenarioLabel,
  scenarioColor,
  onEdit,
  onDelete,
  onSetDefault,
}: PersonaCardProps): JSX.Element {
  const containerStyle: CSSProperties = {
    background: "var(--color-bg-soft)",
    boxShadow: "var(--shadow-card-1)",
    border: persona.isDefault
      ? "2px solid var(--color-text)"
      : "1px solid var(--color-border)",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    fontFamily: "var(--font-inter)",
  };

  const IconComponent =
    PERSONA_ICONS[persona.icon as PersonaIconKey] ?? PersonaUser;

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          aria-hidden
          style={{
            lineHeight: 1,
            flexShrink: 0,
            width: 44,
            height: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-bg-soft)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            color: "var(--color-coral-deep)",
          }}
        >
          <IconComponent size={20} color="var(--color-coral-deep)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              color: "var(--color-text)",
              wordBreak: "break-word",
            }}
          >
            {persona.name}
          </h3>
          {persona.description ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "var(--color-text-mid)",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              {persona.description}
            </p>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        {persona.isDefault ? (
          <Pill variant="lime" uppercase={false}>
            Por defecto
          </Pill>
        ) : null}
        {scenarioLabel && scenarioColor ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              padding: "4px 8px",
              borderRadius: 999,
              background: SCENARIO_BG[scenarioColor],
              border: `1px solid ${SCENARIO_BORDER[scenarioColor]}`,
              color: "var(--color-text)",
              fontFamily:
                "var(--font-mono)",
            }}
          >
            {scenarioLabel}
          </span>
        ) : null}
        {persona.tone ? (
          <Pill variant="ghost" uppercase={false}>
            {PERSONA_TONE_LABELS[persona.tone]}
          </Pill>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: "auto",
          paddingTop: 4,
        }}
      >
        <Button variant="secondary" size="sm" onClick={() => onEdit(persona)}>
          Editar
        </Button>
        {!persona.isDefault ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetDefault(persona)}
          >
            Marcar por defecto
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(persona)}
          style={{ color: "var(--color-danger)" }}
        >
          Eliminar
        </Button>
      </div>
    </div>
  );
}
