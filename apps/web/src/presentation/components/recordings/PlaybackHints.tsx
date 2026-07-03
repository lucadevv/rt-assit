"use client";

/**
 * PlaybackHints — scrollable hints column synced with the audio.
 *
 * Visual: each card shows a lavender accent (hints are AI-generated).
 * Clicking a card seeks to the hint's timestamp. Hints are usually fewer
 * than transcripts so we don't bother with auto-scroll.
 */

import type { JSX } from "react";
import type { Hint } from "@/domain/entities/hint";
import { formatDuration } from "./utils";

interface PlaybackHintsProps {
  hints: Hint[];
  currentTimeSec: number;
  onSeek: (hint: Hint) => void;
}

export function PlaybackHints({
  hints,
  currentTimeSec,
  onSeek,
}: PlaybackHintsProps): JSX.Element {
  if (hints.length === 0) {
    return (
      <div
        style={{
          padding: "24px 16px",
          color: "var(--color-text-mid)",
          fontSize: 13,
          textAlign: "center",
          background: "var(--color-bg-soft)",
          boxShadow: "var(--shadow-card-1)",
          border: "1px dashed var(--color-border)",
          borderRadius: 18,
        }}
      >
        Sin sugerencias guardadas para esta sesión.
      </div>
    );
  }

  // Determine the most-recently-active hint.
  const currentMs = currentTimeSec * 1000;
  let activeId: number | undefined;
  for (const h of hints) {
    if (h.timestampMs <= currentMs) activeId = h.id;
    else break;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: 520,
        overflow: "auto",
        padding: 8,
        background: "var(--color-bg-soft)",
        boxShadow: "var(--shadow-card-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 18,
      }}
    >
      {hints.map((h) => {
        const active = h.id != null && h.id === activeId;
        return (
          <button
            key={h.id ?? `${h.timestampMs}-${h.content.slice(0, 6)}`}
            type="button"
            onClick={() => onSeek(h)}
            aria-current={active ? "true" : undefined}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 12,
              borderLeft: `3px solid ${active ? "var(--color-lavender)" : "transparent"}`,
              background: active ? "var(--color-bg-soft)" : "transparent",
              transition: "background 120ms ease, border-color 120ms ease",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  color: "var(--color-lavender)",
                }}
              >
                Sugerencia
              </span>
              <span
                style={{
                  fontFamily:
                    "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                }}
              >
                {formatDuration(h.timestampMs / 1000)}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--color-text)",
              }}
            >
              {h.content}
            </p>
          </button>
        );
      })}
    </div>
  );
}
