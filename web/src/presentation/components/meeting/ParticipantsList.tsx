"use client";

// Right sidebar listing meeting participants with mute / camera status.

import type { JSX } from "react";
import { Avatar, Card } from "@/design-system/primitives";
import { MicIcon, CamIcon } from "@/design-system/icons";
import type { Participant } from "@/domain/entities/participant";
import { useMeetingStore } from "@/application/stores/meeting.store";

interface ParticipantsListProps {
  participants?: Participant[];
}

function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";
  const initials = `${first.charAt(0)}${second.charAt(0)}`.trim();
  return initials.length > 0 ? initials : first.charAt(0);
}

function ParticipantRow({ participant }: { participant: Participant }): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 12,
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
      }}
    >
      <Avatar size={32} initials={initialsFor(participant.displayName)} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {participant.displayName}
          {participant.isLocal ? (
            <span
              style={{
                marginLeft: 6,
                color: "var(--color-text-mid)",
                fontWeight: 500,
              }}
            >
              (Vos)
            </span>
          ) : null}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--color-text-mid)",
          flexShrink: 0,
        }}
      >
        {participant.isMuted ? (
          // TODO: replace icon when MicOffIcon is added
          <span title="Micrófono apagado" aria-label="Micrófono apagado">
            <MicIcon size={14} />
          </span>
        ) : null}
        {!participant.isCameraOn ? (
          // TODO: replace icon when CamOffIcon is added
          <span title="Cámara apagada" aria-label="Cámara apagada">
            <CamIcon size={14} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ParticipantsList({ participants }: ParticipantsListProps): JSX.Element {
  const storeParticipants = useMeetingStore((s) => s.participants);
  const list = participants ?? storeParticipants;

  // Local first, then everyone else (stable order otherwise).
  const ordered = [...list].sort((a, b) => {
    if (a.isLocal && !b.isLocal) return -1;
    if (!a.isLocal && b.isLocal) return 1;
    return 0;
  });

  return (
    <Card
      variant="soft"
      style={{
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: "100%",
        overflowY: "auto",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "-0.2px",
          color: "var(--color-text)",
          textTransform: "uppercase",
        }}
      >
        Participantes ({ordered.length})
      </h3>
      {ordered.length === 0 ? (
        <span
          style={{
            fontSize: 13,
            color: "var(--color-text-mid)",
            padding: "8px 4px",
          }}
        >
          Esperando participantes...
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ordered.map((p) => (
            <ParticipantRow key={p.id} participant={p} />
          ))}
        </div>
      )}
    </Card>
  );
}
