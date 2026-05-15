"use client";

/**
 * SessionDetailHero — the top hero on /app/sessions/[id].
 *
 * Shows: back arrow + scenario badge + title + start date (long) +
 * duration + status pill. Mirrors the visual rhythm of the recordings
 * detail header without re-using its component (different action surface).
 */

import type { JSX } from "react";
import { Button, Pill } from "@/design-system/primitives";
import type { Session } from "@/domain/entities/session";
import type { Scenario } from "@/domain/entities/scenario";
import {
  STATUS_LABEL,
  effectiveStatus,
  formatSessionDuration,
  formatStartedAtLong,
  scenarioColorOf,
  scenarioColorVar,
  scenarioLabel,
  sessionTitleOrFallback,
  statusPillVariant,
} from "./utils";

interface SessionDetailHeroProps {
  session: Session;
  scenarios: Scenario[];
  onBack: () => void;
  /** Right-side actions slot — typically the SessionActionsMenu. */
  actions?: JSX.Element;
}

export function SessionDetailHero({
  session,
  scenarios,
  onBack,
  actions,
}: SessionDetailHeroProps): JSX.Element {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Volver a la lista
      </Button>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
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
            <Pill variant={color}>
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: colorVar,
                  display: "inline-block",
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              />
              {scenarioLabel(session.scenario, scenarios)}
            </Pill>
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
                      animation: "susurra-blink 1s infinite",
                    }}
                  />
                  {STATUS_LABEL.active}
                </>
              ) : (
                STATUS_LABEL[status]
              )}
            </Pill>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-1px",
              color: "var(--color-text)",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-text-mid)",
              fontFamily:
                "var(--font-jetbrains-mono), ui-monospace, monospace",
            }}
          >
            {formatStartedAtLong(session.startedAt)} · {duration}
          </p>
        </div>

        {actions ? (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
