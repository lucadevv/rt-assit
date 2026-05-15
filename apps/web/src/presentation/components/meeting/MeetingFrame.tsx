"use client";

// Provider-agnostic shell layout for the embedded meeting — video, controls, participants.

import type { JSX, ReactNode } from "react";
import { Card } from "@/design-system/primitives";
import type { Meeting } from "@/domain/entities/meeting";
import { useMeetingStore } from "@/application/stores/meeting.store";
import { VideoTiles } from "./VideoTiles";
import { MeetingControls } from "./MeetingControls";
import { ParticipantsList } from "./ParticipantsList";

interface MeetingFrameProps {
  meeting?: Meeting | null;
  children?: ReactNode;
}

export function MeetingFrame({ meeting, children }: MeetingFrameProps): JSX.Element {
  const storeMeeting = useMeetingStore((s) => s.currentMeeting);
  const effectiveMeeting = meeting !== undefined ? meeting : storeMeeting;
  const hasChildren = children !== undefined && children !== null;

  if (effectiveMeeting === null && !hasChildren) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card
          variant="soft"
          style={{
            maxWidth: 480,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            textAlign: "center",
            padding: 28,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              color: "var(--color-text)",
            }}
          >
            No hay reunión activa
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            Iniciá una nueva sesión para conectar Meet, Zoom o Teams.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 16,
        height: "100%",
        minHeight: 0,
        width: "100%",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          <VideoTiles />
        </div>
        {hasChildren ? <div>{children}</div> : null}
        <MeetingControls />
      </div>
      <ParticipantsList />
    </div>
  );
}
