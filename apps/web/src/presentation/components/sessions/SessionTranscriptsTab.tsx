"use client";

/**
 * SessionTranscriptsTab — second tab. Lists transcripts sorted by
 * `timestampMs` ascending. Each row shows the speaker label (color-coded
 * by `colorHint` from the Speaker entity), the text, and a relative
 * timestamp (e.g. "+12s", "+4 min 20s").
 *
 * Speakers without a custom label show as "Hablante N" where N is the
 * deepgram cluster id + 1 (1-based for humans).
 */

import { useMemo, type JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import type { Transcript } from "@/domain/entities/transcript";
import type { Speaker } from "@/domain/entities/speaker";
import { formatRelativeMs, scenarioColorVar } from "./utils";

interface SessionTranscriptsTabProps {
  transcripts: Transcript[];
  speakers: Speaker[];
}

interface SpeakerLookup {
  label: string;
  colorVar: string;
}

function buildSpeakerLookup(
  speakers: Speaker[],
): Map<number, SpeakerLookup> {
  const map = new Map<number, SpeakerLookup>();
  for (const s of speakers) {
    map.set(s.deepgramSpeakerId, {
      label:
        s.label && s.label.trim().length > 0
          ? s.label
          : `Hablante ${s.deepgramSpeakerId + 1}`,
      colorVar: scenarioColorVar(s.colorHint),
    });
  }
  return map;
}

function fallbackLabel(deepgramSpeaker: number | null): string {
  if (deepgramSpeaker === null) return "Hablante";
  return `Hablante ${deepgramSpeaker + 1}`;
}

export function SessionTranscriptsTab({
  transcripts,
  speakers,
}: SessionTranscriptsTabProps): JSX.Element {
  const lookup = useMemo(() => buildSpeakerLookup(speakers), [speakers]);

  const sorted = useMemo(
    () =>
      [...transcripts]
        .filter((t) => t.isFinal)
        .sort((a, b) => a.timestampMs - b.timestampMs),
    [transcripts],
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
          No hay transcripciones guardadas para esta sesión.
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
        gap: 8,
      }}
    >
      {sorted.map((t, idx) => {
        const meta = t.deepgramSpeaker !== null ? lookup.get(t.deepgramSpeaker) : undefined;
        const speakerLabel = meta?.label ?? fallbackLabel(t.deepgramSpeaker);
        const dotColor = meta?.colorVar ?? "var(--color-text-mid)";
        return (
          <li key={t.id ?? `${idx}-${t.timestampMs}`}>
            <Card
              style={{
                display: "flex",
                gap: 12,
                padding: 14,
                alignItems: "flex-start",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: dotColor,
                  marginTop: 7,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--color-text)",
                    }}
                  >
                    {speakerLabel}
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                      fontSize: 11,
                      color: "var(--color-text-dim)",
                    }}
                  >
                    {formatRelativeMs(t.timestampMs)}
                  </span>
                  {t.language ? (
                    <Pill variant="ghost">{t.language.toUpperCase()}</Pill>
                  ) : null}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "var(--color-text)",
                  }}
                >
                  {t.content}
                </p>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
