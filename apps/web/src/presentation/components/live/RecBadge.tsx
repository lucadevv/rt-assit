"use client";

/**
 * RecBadge (live) — pill with pulsing dot + duration timer.
 *
 * Differs from the shell-level RecBadge: this one always renders (it
 * lives inside the live screen, where "is recording" is implicit), and
 * shows an HH:MM:SS timer driven from the session store.
 */

import type { JSX } from "react";

interface RecBadgeProps {
  durationSeconds: number;
  active: boolean;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function RecBadge({ durationSeconds, active }: RecBadgeProps): JSX.Element {
  return (
    <span
      role="status"
      aria-label={active ? "Grabando" : "Inactivo"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 9999,
        background: active ? "var(--color-lime)" : "var(--color-bg-soft)",
        color: active ? "var(--color-lime-ink)" : "var(--color-text-mid)",
        border: active ? "1px solid transparent" : "1px solid var(--color-border)",
        fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.6px",
        lineHeight: 1.05,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 9999,
          background: active ? "var(--color-lime-ink)" : "var(--color-text-dim)",
          animation: active ? "susurra-rec-pulse 1.2s ease-in-out infinite" : "none",
        }}
      />
      <span>REC</span>
      <span style={{ opacity: 0.85 }}>{formatDuration(durationSeconds)}</span>
    </span>
  );
}
