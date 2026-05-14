"use client";

/**
 * AgentPhaseIndicator — visual "duplex cognitivo" badge that surfaces
 * which lifecycle phase the agent is in:
 *
 *   listening   — interim transcripts arriving (the user is talking).
 *   unclear     — backend gated a low-confidence final; the LLM was
 *                 NOT called and the UI prompts the user to repeat.
 *   thinking    — final transcript received, LLM not streaming yet.
 *   responding  — LLM tokens are streaming.
 *   idle        — nothing happening; component renders `null`.
 *
 * Reads from `useAgentStore.phase` (single source of truth). Each phase
 * has its own colour token + pulse cadence so the user can read the
 * agent's state at a glance from across the room.
 *
 * Lives in the LiveControls header next to the REC badge.
 */

import type { JSX, CSSProperties } from "react";
import {
  useAgentStore,
  selectPhase,
  type AgentPhase,
} from "@/application/stores/agent.store";

interface PhaseConfig {
  label: string;
  color: string;
  pulseMs: number;
}

const PHASE_CONFIG: Record<AgentPhase, PhaseConfig> = {
  idle: { label: "", color: "var(--color-muted)", pulseMs: 0 },
  listening: {
    label: "Escuchando…",
    color: "var(--color-cyan)",
    pulseMs: 500,
  },
  unclear: {
    // Fase E2 — Low-confidence final from Deepgram. Distinct amber-orange
    // tone (not the same amber as "thinking") so the user can tell at a
    // glance that this is a "repeat please" badge, not a working badge.
    label: "No te escuché bien — repetí por favor",
    color: "var(--color-warm, #ff9a3c)",
    pulseMs: 800,
  },
  thinking: {
    label: "Pensando…",
    color: "var(--color-amber)",
    pulseMs: 1000,
  },
  responding: {
    label: "Respondiendo…",
    color: "var(--color-lime)",
    pulseMs: 1500,
  },
};

export function AgentPhaseIndicator(): JSX.Element | null {
  const phase = useAgentStore(selectPhase);
  if (phase === "idle") return null;

  const cfg = PHASE_CONFIG[phase];

  const dotStyle: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: cfg.color,
    flex: "0 0 auto",
    animation: cfg.pulseMs
      ? `auri-phase-pulse ${cfg.pulseMs}ms ease-in-out infinite`
      : "none",
  };

  return (
    <span
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--color-text-mid)",
        fontWeight: 600,
        letterSpacing: "0.2px",
      }}
    >
      <span aria-hidden style={dotStyle} />
      {cfg.label}
    </span>
  );
}
