"use client";

/**
 * CaptureControls — Pause/Resume toggle for the sidebar layout.
 *
 * Pause gates PCM forwarding inside the capture adapter (mirror + level
 * meter keep updating; rt_go just stops receiving audio). Session
 * teardown lives in LiveControls' "Finalizar sesión" — keeping the
 * destructive action in a single, prominent place avoids two redundant
 * stop buttons confusing the user mid-session.
 *
 * Reads `isPaused` from the SessionStore so the UI label flips reactively
 * whenever the capture adapter or any other consumer toggles the state.
 */

import type { JSX } from "react";
import { Button, Pill } from "@/design-system/primitives";
import { useSessionStore } from "@/application/stores/session.store";
import { useContainer } from "@/infrastructure/di/container";

export function CaptureControls(): JSX.Element {
  const { audioCapture } = useContainer();
  const isPaused = useSessionStore((s) => s.isPaused);
  const setPaused = useSessionStore((s) => s.setPaused);

  const togglePause = (): void => {
    if (isPaused) {
      audioCapture.resume?.();
      setPaused(false);
    } else {
      audioCapture.pause?.();
      setPaused(true);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {isPaused ? <Pill variant="amber">Pausado</Pill> : null}
      <Button
        variant={isPaused ? "primary" : "ghost"}
        onClick={togglePause}
        aria-label={
          isPaused ? "Reanudar captura de Auri" : "Pausar captura de Auri"
        }
      >
        {isPaused ? "▶ Reanudar Auri" : "⏸ Pausar Auri"}
      </Button>
    </div>
  );
}
