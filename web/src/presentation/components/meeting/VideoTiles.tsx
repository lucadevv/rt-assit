"use client";

// Renders a responsive grid of <video> tiles, one per active local/remote MediaStreamTrack.

import { useEffect, useRef, type JSX } from "react";
import { Card } from "@/design-system/primitives";
import type { Participant } from "@/domain/entities/participant";
import { useMeetingStore } from "@/application/stores/meeting.store";

interface VideoTilesProps {
  localTrack?: MediaStreamTrack | null;
  remoteTracks?: Record<string, MediaStreamTrack>;
  localLabel?: string;
  participants?: Participant[];
}

function VideoTile({
  track,
  label,
  mirrored = false,
}: {
  track: MediaStreamTrack;
  label: string;
  mirrored?: boolean;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [track]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        background: "var(--color-black)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={mirrored}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: mirrored ? "scaleX(-1)" : undefined,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(0, 0, 0, 0.55)",
          color: "#ffffff",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "-0.1px",
          backdropFilter: "blur(6px)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function VideoTiles({
  localTrack,
  remoteTracks,
  localLabel = "Vos",
  participants,
}: VideoTilesProps): JSX.Element {
  const storeLocal = useMeetingStore((s) => s.localVideoTrack);
  const storeRemote = useMeetingStore((s) => s.remoteVideoTracks);
  const storeParticipants = useMeetingStore((s) => s.participants);

  const effectiveLocal = localTrack !== undefined ? localTrack : storeLocal;
  const effectiveRemote = remoteTracks ?? storeRemote;
  const effectiveParticipants = participants ?? storeParticipants;

  const remoteEntries = Object.entries(effectiveRemote);
  const hasLocal = effectiveLocal !== null;
  const hasAny = hasLocal || remoteEntries.length > 0;

  if (!hasAny) {
    return (
      <Card
        variant="soft"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 240,
          textAlign: "center",
        }}
      >
        <span
          style={{
            color: "var(--color-text-mid)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Cámaras apagadas
        </span>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 12,
        width: "100%",
      }}
    >
      {hasLocal && effectiveLocal ? (
        <VideoTile track={effectiveLocal} label={localLabel} mirrored />
      ) : null}
      {remoteEntries.map(([participantId, track]) => {
        const participant = effectiveParticipants.find((p) => p.id === participantId);
        const label = participant?.displayName ?? participantId;
        return (
          <VideoTile key={participantId} track={track} label={label} />
        );
      })}
    </div>
  );
}
