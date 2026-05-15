"use client";

// Bottom control bar for the Meeting Frame — mute, camera, screen share, leave.

import type { JSX } from "react";
import { Button } from "@/design-system/primitives";
import {
  MicIcon,
  CamIcon,
  ShareIcon,
  LogOutIcon,
} from "@/design-system/icons";
import { useMeetingStore } from "@/application/stores/meeting.store";

interface MeetingControlsProps {
  onToggleMute?: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  onLeave?: () => void;
}

export function MeetingControls({
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
}: MeetingControlsProps): JSX.Element {
  const isMuted = useMeetingStore((s) => s.isMuted);
  const isCameraOn = useMeetingStore((s) => s.isCameraOn);
  const isScreenSharing = useMeetingStore((s) => s.isScreenSharing);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 16,
      }}
    >
      <Button
        variant={isMuted ? "danger" : "ghost"}
        size="md"
        onClick={onToggleMute}
        disabled={onToggleMute === undefined}
        leadingIcon={<MicIcon size={16} />}
        aria-pressed={isMuted}
      >
        {/* TODO: replace icon when MicOffIcon is added */}
        {isMuted ? "Activar micrófono" : "Silenciar"}
      </Button>
      <Button
        variant={isCameraOn ? "ghost" : "danger"}
        size="md"
        onClick={onToggleCamera}
        disabled={onToggleCamera === undefined}
        leadingIcon={<CamIcon size={16} />}
        aria-pressed={isCameraOn}
      >
        {/* TODO: replace icon when CamOffIcon is added */}
        {isCameraOn ? "Apagar cámara" : "Prender cámara"}
      </Button>
      <Button
        variant={isScreenSharing ? "primary" : "ghost"}
        size="md"
        onClick={onToggleScreenShare}
        disabled={onToggleScreenShare === undefined}
        leadingIcon={<ShareIcon size={16} />}
        aria-pressed={isScreenSharing}
      >
        {isScreenSharing ? "Detener compartir" : "Compartir pantalla"}
      </Button>
      <Button
        variant="danger"
        size="md"
        onClick={onLeave}
        disabled={onLeave === undefined}
        leadingIcon={<LogOutIcon size={16} />}
      >
        Salir
      </Button>
    </div>
  );
}
