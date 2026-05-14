"use client";

/**
 * RecordingsList — vertical stack of RecordingCards.
 *
 * Empty arrays are handled by the page (RecordingsEmptyState) — this
 * component only renders the scrollable list itself.
 */

import type { JSX } from "react";
import type { RecordingWithSession } from "@/domain/entities/recording";
import { RecordingCard } from "./RecordingCard";

interface RecordingsListProps {
  recordings: RecordingWithSession[];
  onSelect: (sessionId: string) => void;
}

export function RecordingsList({
  recordings,
  onSelect,
}: RecordingsListProps): JSX.Element {
  return (
    <div
      role="list"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {recordings.map((rec) => (
        <div role="listitem" key={rec.sessionId}>
          <RecordingCard recording={rec} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}
