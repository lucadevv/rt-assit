"use client";

/**
 * PipCompact — minimal in-page surface for `pipMode === "compact"`.
 *
 * Renders ONLY:
 *   1. The agent phase indicator (escuchando / pensando / respondiendo).
 *   2. The latest Susurra hint (current streaming response, or the last
 *      finished response if nothing is streaming right now).
 *   3. A small "Detener" CTA so the user can end capture without
 *      switching layouts.
 *
 * Transcripts, audio meter and capture controls are intentionally
 * hidden — compact mode is the "high signal, low chrome" experience the
 * user picked from TweaksPanel. The full-fat experience lives in the
 * floating PiP window (opened from PipLayout) which is unaffected.
 *
 * Reads from `useSessionStore` and `useAgentStore` — no props. Wiring
 * lives in PipLayout, which picks PipCompact vs the regular in-page
 * fallback based on `pipMode`.
 */

import type { CSSProperties, JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import {
  useAgentStore,
  selectIsThinking,
} from "@/application/stores/agent.store";
import { useSessionStore } from "@/application/stores/session.store";
import { useScenarioStore } from "@/application/stores/scenario.store";
import { scenarioColorOf } from "@/domain/entities/scenario";
import { useLiveSession } from "@/presentation/hooks/use-live-session";
import { AgentPhaseIndicator } from "./AgentPhaseIndicator";

const accentVar = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
} as const;

export function PipCompact(): JSX.Element {
  const currentResponse = useAgentStore((s) => s.currentResponse);
  const responses = useAgentStore((s) => s.responses);
  const isThinking = useAgentStore(selectIsThinking);

  const isCapturing = useSessionStore((s) => s.isCapturing);
  const scenarioId = useScenarioStore((s) => s.current);
  const accent = scenarioId ? scenarioColorOf(scenarioId) : "lime";

  const { stop } = useLiveSession();

  const lastResponse = responses[responses.length - 1]?.text ?? "";
  const visibleResponse = currentResponse || lastResponse;

  const cardStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 20,
    borderLeft: `3px solid ${accentVar[accent]}`,
  };

  return (
    <Card bordered padded={false} style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Pill variant={isCapturing ? "lime" : "ghost"}>
            {isCapturing ? "PiP · Compacto" : "Compacto"}
          </Pill>
          <AgentPhaseIndicator />
        </div>
        {isCapturing ? (
          <Button variant="ghost" size="sm" onClick={() => void stop()}>
            Detener
          </Button>
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--color-text-dim)",
          }}
        >
          Susurra
        </div>
        {isThinking && !visibleResponse ? (
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--color-text-mid)",
              fontStyle: "italic",
            }}
          >
            Pensando…
          </p>
        ) : visibleResponse ? (
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--color-text)",
              fontWeight: 500,
            }}
          >
            {visibleResponse}
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-text-dim)",
              fontStyle: "italic",
            }}
          >
            Sin respuestas todavía. Susurra mostrará acá la última sugerencia
            apenas hable la contraparte.
          </p>
        )}
      </div>
    </Card>
  );
}
