"use client";

/**
 * LiveControls — header bar of the live screen. Shows:
 *   - Start / Stop button (primary CTA)
 *   - REC badge with timer (always visible, animates while capturing)
 *   - Status row with WS connectivity, frames, bytes
 */

import type { JSX } from "react";
import { Button } from "@/design-system/primitives";
import { MicIcon, XIcon } from "@/design-system/icons";
import { RecBadge } from "./RecBadge";
import { AgentPhaseIndicator } from "./AgentPhaseIndicator";
import { useSessionStore } from "@/application/stores/session.store";

interface LiveControlsProps {
  onStart: () => void;
  onStop: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * ScribeModePill — small visual indicator that the active session is in
 * "scribe" mode. Sits next to RecBadge in the live header so the user
 * always knows which prompt context is driving the agent.
 */
function ScribeModePill(): JSX.Element {
  return (
    <span
      role="status"
      aria-label="Modo Scribe activo"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 9999,
        background:
          "color-mix(in oklab, var(--color-lavender) 22%, var(--color-bg))",
        color: "var(--color-text)",
        border: "1px solid var(--color-lavender)",
        fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.6px",
        lineHeight: 1.05,
      }}
    >
      <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
        {"\u{1F4DD}"}
      </span>
      <span>MODO SCRIBE</span>
    </span>
  );
}

export function LiveControls({ onStart, onStop }: LiveControlsProps): JSX.Element {
  const isCapturing = useSessionStore((s) => s.isCapturing);
  const session = useSessionStore((s) => s.session);
  const durationSeconds = useSessionStore((s) => s.durationSeconds);
  const framesSent = useSessionStore((s) => s.framesSent);
  const bytesSent = useSessionStore((s) => s.bytesSent);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px",
        background: "var(--color-bg-soft)",
        border: "1px solid var(--color-border)",
        borderRadius: 18,
      }}
    >
      {!isCapturing ? (
        <Button
          variant="primary"
          size="md"
          onClick={onStart}
          leadingIcon={<MicIcon size={18} />}
        >
          Iniciar captura
        </Button>
      ) : (
        <Button
          variant="danger"
          size="md"
          onClick={onStop}
          leadingIcon={<XIcon size={18} />}
        >
          Finalizar sesión
        </Button>
      )}

      <RecBadge durationSeconds={durationSeconds} active={isCapturing} />

      {session?.mode === "scribe" ? <ScribeModePill /> : null}

      <AgentPhaseIndicator />

      <div
        style={{
          display: "flex",
          gap: 14,
          flex: 1,
          flexWrap: "wrap",
          fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
          fontSize: 11,
          color: "var(--color-text-mid)",
          letterSpacing: "0.4px",
        }}
        aria-live="polite"
      >
        <span>frames: {framesSent}</span>
        <span>uplink: {formatBytes(bytesSent)}</span>
        {session ? (
          <span>
            session:{" "}
            <span style={{ color: "var(--color-text)" }}>
              {session.id.slice(0, 8)}…
            </span>{" "}
            ·{" "}
            <span
              style={{
                color:
                  session.status === "active"
                    ? "var(--color-lime-ink)"
                    : "var(--color-text-mid)",
              }}
            >
              {session.status}
            </span>
          </span>
        ) : (
          <span>session: —</span>
        )}
      </div>
    </div>
  );
}
