"use client";

/**
 * TranscriptDoc — flowing-document layout: each speaker's turn becomes
 * a paragraph with the label inline. Designed for note-taking sessions
 * (oral exams / interviews where you read after the call).
 */

import type { JSX } from "react";
import { useSessionStore } from "@/application/stores/session.store";
import type { Transcript } from "@/domain/entities/transcript";
import type { Speaker } from "@/domain/entities/speaker";
import { SpeakerLabel } from "../SpeakerLabel";

function speakerKey(t: Transcript): number | null {
  return t.deepgramSpeaker ?? t.speakerId ?? null;
}

interface ParagraphProps {
  transcript: Transcript;
  speakers: Map<number, Speaker>;
  isInterim?: boolean;
}

function Paragraph({
  transcript,
  speakers,
  isInterim = false,
}: ParagraphProps): JSX.Element {
  const key = speakerKey(transcript);
  const speaker = key != null ? speakers.get(key) : undefined;
  return (
    <p
      style={{
        margin: 0,
        padding: "8px 0",
        fontSize: 13,
        lineHeight: 1.6,
        color: isInterim ? "var(--color-text-mid)" : "var(--color-text)",
        fontStyle: isInterim ? "italic" : "normal",
      }}
    >
      <span style={{ marginRight: 8, verticalAlign: "middle" }}>
        {speaker ? (
          <SpeakerLabel speaker={speaker} size="sm" />
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-text-mid)",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {key != null ? `Hablante ${key + 1}` : "—"}
          </span>
        )}
      </span>
      <span>{transcript.content}</span>
    </p>
  );
}

export function TranscriptDoc(): JSX.Element {
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
        El documento se llenará automáticamente con cada turno hablado.
      </div>
    );
  }

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      {transcripts.map((t, idx) => (
        <Paragraph
          key={t.id ?? `tx-${idx}-${t.timestampMs}`}
          transcript={t}
          speakers={speakers}
        />
      ))}
      {interim ? (
        <Paragraph transcript={interim} speakers={speakers} isInterim />
      ) : null}
    </article>
  );
}
