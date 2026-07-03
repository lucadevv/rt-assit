"use client";

/**
 * RecBadge — animated "REC" pill that lights up when the user is in a live
 * session.
 *
 * Phase note: F2 (Live Screen) hooks the recording state up to the audio
 * pipeline. F1 only ships the visual primitive plus an `isRecording` prop
 * so it can be exercised from layouts/pages once available.
 */

import type { JSX } from "react";

interface RecBadgeProps {
  isRecording?: boolean;
  label?: string;
}

export function RecBadge({
  isRecording = false,
  label = "REC",
}: RecBadgeProps): JSX.Element | null {
  if (!isRecording) {
    return null;
  }
  return (
    <span
      className="susurra-rec-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 9999,
        background: "var(--color-lime)",
        color: "var(--color-lime-ink)",
        fontFamily: "var(--font-inter)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        lineHeight: 1.05,
      }}
      aria-label="Grabando"
      role="status"
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 9999,
          background: "var(--color-lime-ink)",
          animation: "susurra-rec-pulse 1.2s ease-in-out infinite",
        }}
      />
      {label}
    </span>
  );
}
