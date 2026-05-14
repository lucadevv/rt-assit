"use client";

/**
 * RecordingCard — single row in the recordings list.
 *
 * Visual:
 *  - Left: scenario-coloured square thumb with a play icon.
 *  - Mid:  title + scenario pill + date.
 *  - Right: duration + size + chevron CTA.
 *
 * Click anywhere on the card → onSelect(sessionId). Hover lifts the
 * border + reveals an explicit "Reproducir" affordance.
 */

import { useState, type JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import type { RecordingWithSession } from "@/domain/entities/recording";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  scenarioColorOfId,
  scenarioColorVar,
  scenarioLabel,
  sessionTitleOrFallback,
} from "./utils";

interface RecordingCardProps {
  recording: RecordingWithSession;
  onSelect: (sessionId: string) => void;
}

export function RecordingCard({
  recording,
  onSelect,
}: RecordingCardProps): JSX.Element {
  const [hover, setHover] = useState(false);
  const color = scenarioColorOfId(recording.sessionScenario);
  const colorVar = scenarioColorVar(color);
  const title = sessionTitleOrFallback(
    recording.sessionTitle,
    recording.sessionScenario,
    recording.sessionStartedAt,
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(recording.sessionId)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        width: "100%",
      }}
      aria-label={`Reproducir grabación ${title}`}
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
            width: 56,
            height: 56,
            borderRadius: 14,
            background: colorVar,
            color: "var(--color-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {/* Play triangle */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M5 3.5 L16 10 L5 16.5 Z" />
          </svg>
        </div>

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
            <Pill variant="ghost">{scenarioLabel(recording.sessionScenario)}</Pill>
            <span
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 11,
                color: "var(--color-text-dim)",
                letterSpacing: "0.4px",
                textTransform: "uppercase",
              }}
            >
              {recording.audioFormat}
            </span>
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
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--color-text-mid)",
            }}
          >
            {formatDateTime(recording.sessionStartedAt)}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily:
                "var(--font-jetbrains-mono), ui-monospace, monospace",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            {formatDuration(recording.audioDurationSeconds)}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-dim)",
            }}
          >
            {formatBytes(recording.audioSizeBytes)}
          </span>
          <span
            style={{
              fontSize: 12,
              color: hover ? colorVar : "var(--color-text-mid)",
              fontWeight: 600,
              transition: "color 120ms ease",
            }}
          >
            {hover ? "Reproducir →" : "→"}
          </span>
        </div>
      </Card>
    </button>
  );
}
