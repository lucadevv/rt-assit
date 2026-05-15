"use client";

/**
 * TranscriptChat — conversation bubbles alternating per speaker, with a
 * small avatar dot using the speaker's scenario color.
 */

import type { JSX } from "react";
import { useSessionStore } from "@/application/stores/session.store";
import { SpeakerLabel } from "../SpeakerLabel";
import type { Transcript } from "@/domain/entities/transcript";
import type { Speaker } from "@/domain/entities/speaker";
import type { ScenarioColor } from "@/domain/entities/scenario";

const colorBg: Record<ScenarioColor, string> = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
};

const colorInk: Record<ScenarioColor, string> = {
  cyan: "var(--color-cyan-ink)",
  amber: "var(--color-amber-ink)",
  lavender: "var(--color-lavender-ink)",
  lime: "var(--color-lime-ink)",
};

function speakerKey(t: Transcript): number | null {
  return t.deepgramSpeaker ?? t.speakerId ?? null;
}

function speakerColor(speaker: Speaker | undefined): ScenarioColor {
  return speaker?.colorHint ?? "lime";
}

function ensureSpeakerForKey(
  speakers: Map<number, Speaker>,
  key: number | null,
): Speaker | undefined {
  if (key == null) return undefined;
  return speakers.get(key);
}

interface BubbleProps {
  transcript: Transcript;
  speakers: Map<number, Speaker>;
  align: "left" | "right";
  isInterim?: boolean;
}

function Bubble({
  transcript,
  speakers,
  align,
  isInterim = false,
}: BubbleProps): JSX.Element {
  const key = speakerKey(transcript);
  const speaker = ensureSpeakerForKey(speakers, key);
  const color = speakerColor(speaker);
  const justify = align === "right" ? "flex-end" : "flex-start";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: justify === "flex-end" ? "flex-end" : "flex-start",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 9999,
            background: colorBg[color],
            border: "1px solid var(--color-border)",
          }}
        />
        {speaker ? (
          <SpeakerLabel speaker={speaker} size="sm" />
        ) : (
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-mid)",
              fontWeight: 700,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
            }}
          >
            {key != null ? `Hablante ${key + 1}` : "—"}
          </span>
        )}
      </div>
      <div
        style={{
          maxWidth: "75%",
          padding: "10px 14px",
          borderRadius: 18,
          background: isInterim
            ? "var(--color-bg-soft)"
            : speaker
              ? colorBg[color]
              : "var(--color-bg-soft)",
          color: isInterim
            ? "var(--color-text-mid)"
            : speaker
              ? colorInk[color]
              : "var(--color-text)",
          border: "1px solid var(--color-border)",
          fontSize: 13,
          lineHeight: 1.5,
          opacity: isInterim ? 0.85 : 1,
          fontStyle: isInterim ? "italic" : "normal",
          whiteSpace: "pre-wrap",
        }}
      >
        {transcript.content}
      </div>
    </div>
  );
}

export function TranscriptChat(): JSX.Element {
  const transcripts = useSessionStore((s) => s.transcripts);
  const interim = useSessionStore((s) => s.interim);
  const speakers = useSessionStore((s) => s.speakers);

  if (transcripts.length === 0 && !interim) {
    return (
      <div
        style={{
          color: "var(--color-text-dim)",
          fontStyle: "italic",
          padding: 24,
          textAlign: "center",
          fontSize: 14,
        }}
      >
        Esperando audio… las transcripciones aparecerán acá en tiempo real.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {transcripts.map((t, idx) => {
        const key = speakerKey(t);
        // Even keys → left, odd keys → right (alternation per speaker).
        const align: "left" | "right" =
          key != null && key % 2 === 1 ? "right" : "left";
        return (
          <Bubble
            key={t.id ?? `tx-${idx}-${t.timestampMs}`}
            transcript={t}
            speakers={speakers}
            align={align}
          />
        );
      })}
      {interim ? (
        <Bubble
          transcript={interim}
          speakers={speakers}
          align={
            speakerKey(interim) != null && (speakerKey(interim) as number) % 2 === 1
              ? "right"
              : "left"
          }
          isInterim
        />
      ) : null}
    </div>
  );
}
