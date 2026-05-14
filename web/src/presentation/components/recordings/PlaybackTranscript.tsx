"use client";

/**
 * PlaybackTranscript — scrollable transcript list synced with the audio.
 *
 * Visual:
 *  - Each row shows speaker label (or "Speaker N"), monospace timestamp,
 *    and content. Speaker label colour comes from the speaker's
 *    `colorHint` (B3 convention).
 *  - The active row gets a soft background + lime left border.
 *  - Clicking a row triggers `onSeek(transcript)` which the parent wires
 *    to `sync.seekToTimestampMs`.
 *
 * Auto-scroll: when the active row changes, scroll it into view smoothly
 * (only if not in a user-triggered scroll cooldown — handled via a guard
 * timeout).
 */

import { useEffect, useMemo, useRef, type JSX } from "react";
import type { Transcript } from "@/domain/entities/transcript";
import type { Speaker } from "@/domain/entities/speaker";
import type { ScenarioColor } from "@/domain/entities/scenario";
import { scenarioColorVar } from "./utils";
import { formatDuration } from "./utils";

interface PlaybackTranscriptProps {
  transcripts: Transcript[];
  speakers: Speaker[];
  activeTranscriptId: number | null;
  onSeek: (transcript: Transcript) => void;
}

interface RowProps {
  transcript: Transcript;
  speaker: Speaker | null;
  active: boolean;
  onSeek: (t: Transcript) => void;
  registerRef: (el: HTMLButtonElement | null, id: number | undefined) => void;
}

function Row({
  transcript,
  speaker,
  active,
  onSeek,
  registerRef,
}: RowProps): JSX.Element {
  const colorHint: ScenarioColor = speaker?.colorHint ?? "lime";
  const labelColor = scenarioColorVar(colorHint);
  const speakerLabel =
    speaker?.label ??
    (speaker?.isUser
      ? "Vos"
      : speaker?.deepgramSpeakerId != null
        ? `Speaker ${speaker.deepgramSpeakerId + 1}`
        : "—");

  return (
    <button
      type="button"
      ref={(el) => registerRef(el, transcript.id)}
      onClick={() => onSeek(transcript)}
      aria-current={active ? "true" : undefined}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px 10px 14px",
        borderRadius: 10,
        borderLeft: `3px solid ${active ? "var(--color-lime)" : "transparent"}`,
        background: active ? "var(--color-bg-soft)" : "transparent",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: labelColor,
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
          {formatDuration(transcript.timestampMs / 1000)}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.55,
          color: active ? "var(--color-text)" : "var(--color-text-mid)",
        }}
      >
        {transcript.content}
      </p>
    </button>
  );
}

export function PlaybackTranscript({
  transcripts,
  speakers,
  activeTranscriptId,
  onSeek,
}: PlaybackTranscriptProps): JSX.Element {
  const speakerMap = useMemo(() => {
    const m = new Map<number, Speaker>();
    for (const s of speakers) m.set(s.id, s);
    return m;
  }, [speakers]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const userScrolledRef = useRef(false);
  const userScrollResetTimerRef = useRef<number | null>(null);

  // Track when the user manually scrolls so we don't fight them.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      userScrolledRef.current = true;
      if (userScrollResetTimerRef.current !== null) {
        window.clearTimeout(userScrollResetTimerRef.current);
      }
      userScrollResetTimerRef.current = window.setTimeout(() => {
        userScrolledRef.current = false;
      }, 4000);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (userScrollResetTimerRef.current !== null) {
        window.clearTimeout(userScrollResetTimerRef.current);
      }
    };
  }, []);

  // Auto-scroll the active row into view (unless user scrolled).
  useEffect(() => {
    if (activeTranscriptId == null) return;
    if (userScrolledRef.current) return;
    const row = rowRefs.current.get(activeTranscriptId);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTranscriptId]);

  const registerRef = (
    el: HTMLButtonElement | null,
    id: number | undefined,
  ): void => {
    if (id === undefined) return;
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  if (transcripts.length === 0) {
    return (
      <div
        style={{
          padding: "24px 16px",
          color: "var(--color-text-mid)",
          fontSize: 14,
          textAlign: "center",
        }}
      >
        No hay transcript para esta sesión.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxHeight: 520,
        overflow: "auto",
        padding: 8,
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 18,
      }}
    >
      {transcripts.map((t) => {
        const speaker = t.speakerId != null ? speakerMap.get(t.speakerId) ?? null : null;
        const active = t.id != null && t.id === activeTranscriptId;
        return (
          <Row
            key={t.id ?? `${t.timestampMs}-${t.content.slice(0, 8)}`}
            transcript={t}
            speaker={speaker}
            active={active}
            onSeek={onSeek}
            registerRef={registerRef}
          />
        );
      })}
    </div>
  );
}
