"use client";

/**
 * SpeakerLabel — click-to-edit speaker chip.
 *
 *   - Resting state: shows the speaker label (or "Hablante {N}" fallback)
 *     in a pill colored by the scenario.
 *   - Editing state: input + save/cancel keys (Enter/Esc).
 *
 * Submit calls `useRenameSpeaker.rename` which optimistically updates the
 * store and reconciles via the WS broadcast.
 */

import { useEffect, useRef, useState, type JSX } from "react";
import type { Speaker } from "@/domain/entities/speaker";
import type { ScenarioColor } from "@/domain/entities/scenario";
import { useRenameSpeaker } from "@/presentation/hooks/use-rename-speaker";

interface SpeakerLabelProps {
  speaker: Speaker;
  fallbackColor?: ScenarioColor;
  size?: "sm" | "md";
}

const colorVar: Record<ScenarioColor, { bg: string; ink: string }> = {
  cyan: { bg: "var(--color-cyan)", ink: "var(--color-cyan-ink)" },
  amber: { bg: "var(--color-amber)", ink: "var(--color-amber-ink)" },
  lavender: { bg: "var(--color-lavender)", ink: "var(--color-lavender-ink)" },
  lime: { bg: "var(--color-lime)", ink: "var(--color-lime-ink)" },
};

function defaultLabel(deepgramSpeakerId: number): string {
  return `Hablante ${deepgramSpeakerId + 1}`;
}

export function SpeakerLabel({
  speaker,
  fallbackColor = "lime",
  size = "md",
}: SpeakerLabelProps): JSX.Element {
  const { rename } = useRenameSpeaker();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(speaker.label ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(speaker.label ?? "");
  }, [speaker.label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const color = colorVar[speaker.colorHint] ?? colorVar[fallbackColor];
  const padding = size === "sm" ? "3px 10px" : "5px 12px";
  const fontSize = size === "sm" ? 11 : 12;

  const display = speaker.label ?? defaultLabel(speaker.deepgramSpeakerId);

  if (editing) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding,
          borderRadius: 9999,
          background: color.bg,
          color: color.ink,
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontSize,
          fontWeight: 700,
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const next = draft.trim();
              void rename(speaker.deepgramSpeakerId, next.length > 0 ? next : null);
              setEditing(false);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(speaker.label ?? "");
              setEditing(false);
            }
          }}
          onBlur={() => {
            const next = draft.trim();
            if (next !== (speaker.label ?? "").trim()) {
              void rename(speaker.deepgramSpeakerId, next.length > 0 ? next : null);
            }
            setEditing(false);
          }}
          aria-label="Renombrar hablante"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: color.ink,
            font: "inherit",
            width: Math.max(60, draft.length * 8 + 20),
          }}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click para renombrar"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding,
        borderRadius: 9999,
        background: color.bg,
        color: color.ink,
        border: "1px solid transparent",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.4px",
        cursor: "pointer",
      }}
      className="auri-btn"
    >
      {display}
    </button>
  );
}
