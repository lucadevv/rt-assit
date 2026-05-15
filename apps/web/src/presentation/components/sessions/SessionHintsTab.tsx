"use client";

/**
 * SessionHintsTab — third tab ("Sugerencias"). Lists the agent's
 * persisted hints chronologically with the relative timestamp.
 *
 * NOTE — the domain `Hint` entity has a single `content` field; there is
 * no separate "prompt question" stored alongside the response yet. The
 * task spec asks for `prompt (italic) + response`. Until the backend
 * surfaces the trigger transcript, we render the related transcript
 * snippet (when `relatedTranscriptId` resolves) as the contextual prompt
 * and the hint content as the agent response. When no related transcript
 * is available we just render the response.
 */

import { useMemo, type JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import type { Hint } from "@/domain/entities/hint";
import type { Transcript } from "@/domain/entities/transcript";
import { formatRelativeMs } from "./utils";

interface SessionHintsTabProps {
  hints: Hint[];
  transcripts: Transcript[];
}

export function SessionHintsTab({
  hints,
  transcripts,
}: SessionHintsTabProps): JSX.Element {
  const byId = useMemo(() => {
    const map = new Map<number, Transcript>();
    for (const t of transcripts) {
      if (t.id !== undefined) map.set(t.id, t);
    }
    return map;
  }, [transcripts]);

  const sorted = useMemo(
    () => [...hints].sort((a, b) => a.timestampMs - b.timestampMs),
    [hints],
  );

  if (sorted.length === 0) {
    return (
      <Card variant="soft">
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            textAlign: "center",
            padding: "20px 8px",
          }}
        >
          Sin sugerencias guardadas para esta sesión.
        </p>
      </Card>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {sorted.map((h, idx) => {
        const related =
          h.relatedTranscriptId !== null
            ? byId.get(h.relatedTranscriptId)
            : undefined;
        return (
          <li key={h.id ?? `${idx}-${h.timestampMs}`}>
            <Card
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                borderLeft: "3px solid var(--color-lavender)",
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
                <Pill variant="lavender">Sugerencia</Pill>
                <span
                  style={{
                    fontFamily:
                      "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 11,
                    color: "var(--color-text-dim)",
                  }}
                >
                  {formatRelativeMs(h.timestampMs)}
                </span>
              </div>

              {related ? (
                <p
                  style={{
                    margin: 0,
                    fontStyle: "italic",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--color-text-mid)",
                    paddingLeft: 10,
                    borderLeft: "2px solid var(--color-border)",
                  }}
                >
                  “{related.content}”
                </p>
              ) : null}

              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--color-text)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {h.content}
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
