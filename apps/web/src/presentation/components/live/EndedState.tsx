"use client";

/**
 * EndedState — post-stop summary card shown in /app/live when the user
 * has just finished a session.
 *
 * Renders when `useSessionStore().session.status === "ended"`. Pulls all
 * data from the session store (no extra fetch): scenario, duration,
 * transcript count, agent message count.
 *
 * CTAs:
 *  - "Nueva sesión"  → navigates to /app (Wave 2 will swap for the
 *    "Modal Nueva Sesión"; for now /app is the natural restart point).
 *  - "Ver historial" → /app/sessions  (history page, F8).
 *
 * The "reset" action clears the session store so the LivePage falls back
 * to the idle layout if the user dismisses the card without navigating.
 */

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Pill } from "@/design-system/primitives";
import { ArrowRightIcon, CheckIcon, MicIcon } from "@/design-system/icons";
import { useSessionStore } from "@/application/stores/session.store";
import { useAgentStore } from "@/application/stores/agent.store";
import { useScenarioStore } from "@/application/stores/scenario.store";
import { scenarioColorOf } from "@/domain/entities/scenario";
import type { Session } from "@/domain/entities/session";
import { NewSessionModal } from "@/presentation/components/sessions/NewSessionModal";

interface EndedStateProps {
  session: Session;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, "0")}m`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  }
  return `${secs}s`;
}

const colorBg: Record<ReturnType<typeof scenarioColorOf>, string> = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
};

export function EndedState({ session }: EndedStateProps): JSX.Element {
  const router = useRouter();
  const transcripts = useSessionStore((s) => s.transcripts);
  const localDuration = useSessionStore((s) => s.durationSeconds);
  const reset = useSessionStore((s) => s.reset);
  const agentResponses = useAgentStore((s) => s.responses);
  const scenarios = useScenarioStore((s) => s.available);
  const [modalOpen, setModalOpen] = useState(false);

  const accent = scenarioColorOf(session.scenario);
  const accentBg = colorBg[accent];
  const scenarioLabel =
    scenarios.find((sc) => sc.id === session.scenario)?.label ?? session.scenario;

  // Backend authoritative duration first, fall back to live timer.
  const durationSeconds = session.durationSeconds ?? localDuration;
  // Final transcripts only — interim never reaches the array.
  const transcriptCount = transcripts.filter((t) => t.isFinal).length;
  const agentCount = agentResponses.length;

  const goNew = (): void => {
    // Reset clears the live session store so the modal lands on a clean
    // /app/live mount once the user confirms. The modal handles the
    // navigation itself.
    reset();
    setModalOpen(true);
  };

  const goHistory = (): void => {
    reset();
    router.push("/app/sessions");
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 0",
      }}
    >
      <Card
        bordered
        padded={false}
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: accentBg,
            color: "var(--color-black)",
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              opacity: 0.78,
            }}
          >
            <CheckIcon size={14} />
            <span>Sesión finalizada</span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-1.2px",
              lineHeight: 1.05,
            }}
          >
            ¡Listo! Tu sesión quedó grabada
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              opacity: 0.85,
              maxWidth: 520,
            }}
          >
            Podés revisar la transcripción, generar un resumen o empezar otra
            sesión cuando quieras.
          </p>
        </div>

        <div
          style={{
            padding: "24px 32px",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          <SummaryItem label="Escenario" value={scenarioLabel} accent={accent} />
          <SummaryItem
            label="Duración"
            value={formatDuration(durationSeconds)}
          />
          <SummaryItem
            label="Líneas transcriptas"
            value={String(transcriptCount)}
          />
          <SummaryItem
            label="Mensajes de Susurra"
            value={String(agentCount)}
          />
        </div>

        <div
          style={{
            padding: "0 32px 28px",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="primary"
            size="md"
            leadingIcon={<MicIcon size={16} />}
            onClick={goNew}
          >
            Nueva sesión
          </Button>
          <Button
            variant="secondary"
            size="md"
            trailingIcon={<ArrowRightIcon size={16} />}
            onClick={goHistory}
          >
            Ver historial
          </Button>
        </div>
      </Card>
      <NewSessionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
  accent?: ReturnType<typeof scenarioColorOf>;
}

function SummaryItem({ label, value, accent }: SummaryItemProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--color-bg-soft)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "var(--color-text-mid)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.6px",
          color: "var(--color-text)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {value}
        {accent ? <Pill variant={accent}>•</Pill> : null}
      </span>
    </div>
  );
}
