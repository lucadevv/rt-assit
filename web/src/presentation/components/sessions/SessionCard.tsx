"use client";

/**
 * SessionCard — single row in the /app/sessions list.
 *
 * Visual:
 *  - Left: scenario-coloured square thumb.
 *  - Mid:  title + scenario pill + date + duration.
 *  - Right: status pill (Activa = lime con punto blink, Abandonada = amber,
 *    Finalizada = ghost).
 *
 * Click → router.push(`/app/sessions/${id}`). The card is wrapped in a
 * full-width button to keep keyboard a11y for free.
 */

import { useState, type JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import type { Session } from "@/domain/entities/session";
import type { Scenario } from "@/domain/entities/scenario";
import {
  STATUS_LABEL,
  effectiveStatus,
  formatSessionDuration,
  formatStartedAtShort,
  scenarioColorOf,
  scenarioColorVar,
  scenarioLabel,
  sessionTitleOrFallback,
  statusPillVariant,
} from "./utils";

interface SessionCardProps {
  session: Session;
  scenarios: Scenario[];
  onSelect: (sessionId: string) => void;
}

export function SessionCard({
  session,
  scenarios,
  onSelect,
}: SessionCardProps): JSX.Element {
  const [hover, setHover] = useState(false);
  const color = scenarioColorOf(session.scenario);
  const colorVar = scenarioColorVar(color);
  const title = sessionTitleOrFallback(
    session.title,
    session.scenario,
    session.startedAt,
    scenarios,
  );
  const status = effectiveStatus(session);
  const duration = formatSessionDuration(session.durationSeconds);

  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={`Abrir sesión ${title}`}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        width: "100%",
      }}
    >
      <Card
        variant="default"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 16,
          transition: "border-color 120ms ease, transform 120ms ease",
          borderColor: hover ? colorVar : "var(--color-border)",
          transform: hover ? "translateY(-1px)" : "translateY(0)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: colorVar,
            flexShrink: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Pill variant={color}>{scenarioLabel(session.scenario, scenarios)}</Pill>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              fontSize: 12,
              color: "var(--color-text-mid)",
            }}
          >
            <span>{formatStartedAtShort(session.startedAt)}</span>
            <span aria-hidden="true">·</span>
            <span
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
              }}
            >
              {duration}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Pill variant={statusPillVariant(status)}>
            {status === "active" ? (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "currentColor",
                    marginRight: 6,
                    animation: "auri-blink 1s infinite",
                  }}
                />
                {STATUS_LABEL.active}
              </>
            ) : (
              STATUS_LABEL[status]
            )}
          </Pill>
          <span
            style={{
              fontSize: 12,
              color: hover ? colorVar : "var(--color-text-mid)",
              fontWeight: 600,
              transition: "color 120ms ease",
            }}
          >
            {hover ? "Ver detalle →" : "→"}
          </span>
        </div>
      </Card>
    </button>
  );
}
