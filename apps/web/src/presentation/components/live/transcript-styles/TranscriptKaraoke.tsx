"use client";

/**
 * TranscriptKaraoke — large subtitle-style text at the bottom of the area,
 * showing only the LAST 1-2 lines. Designed for at-a-glance reading while
 * the user is still speaking.
 */

import type { JSX } from "react";
import { useSessionStore } from "@/application/stores/session.store";
import type { Transcript } from "@/domain/entities/transcript";
import type { Speaker } from "@/domain/entities/speaker";
import { SpeakerLabel } from "../SpeakerLabel";

const TAIL = 2;

function speakerKey(t: Transcript): number | null {
  return t.deepgramSpeaker ?? t.speakerId ?? null;
}

function Lines({
  list,
  speakers,
}: {
  list: Transcript[];
  speakers: Map<number, Speaker>;
}): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {list.map((t, idx) => {
        const key = speakerKey(t);
        const speaker = key != null ? speakers.get(key) : undefined;
        return (
          <div
            key={t.id ?? `tx-${idx}-${t.timestampMs}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              animation: "susurra-karaoke-fade-in 200ms ease-out",
            }}
          >
            {speaker ? <SpeakerLabel speaker={speaker} size="sm" /> : null}
            <span
              style={{
                fontSize: 18,
                lineHeight: 1.4,
                fontWeight: 600,
                letterSpacing: "-0.3px",
                color: "var(--color-text)",
              }}
            >
              {t.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TranscriptKaraoke(): JSX.Element {
  const transcripts = useSessionStore((s) => s.transcripts);
  const interim = useSessionStore((s) => s.interim);
  const speakers = useSessionStore((s) => s.speakers);

  const tail = transcripts.slice(-TAIL);
  const visible = interim ? [...tail, interim] : tail;

  if (visible.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-dim)",
          fontSize: 14,
          fontStyle: "italic",
        }}
      >
        Esperando audio…
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "stretch",
        padding: "32px 8px 16px",
      }}
    >
      <div style={{ flex: 1 }}>
        <style>{`@keyframes susurra-karaoke-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <Lines list={visible} speakers={speakers} />
      </div>
    </div>
  );
}
