"use client";

/**
 * AudioPlayer — custom F8 playback control built on the native HTML5
 * `<audio>` element.
 *
 * Why custom (vs <audio controls>):
 *  - We need fine-grained control of currentTime + speed for the synced
 *    transcript, and we want the design to match the rest of Susurra.
 *  - The native chrome differs across browsers — a custom UI is more
 *    consistent for marketing screenshots + design review.
 *
 * The hidden `<audio>` element is owned here; the actual `useAudioSync`
 * hook is lifted into RecordingDetail so PlaybackTranscript can call
 * seekToTimestampMs on click. We receive the bound handlers + state via
 * the `sync` prop.
 */

import { useCallback, useMemo, type JSX } from "react";
import { Button } from "@/design-system/primitives";
import type { useAudioSync } from "@/presentation/hooks/use-audio-sync";
import { formatDuration } from "./utils";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

interface AudioPlayerProps {
  audioUrl: string;
  sync: ReturnType<typeof useAudioSync>;
}

export function AudioPlayer({ audioUrl, sync }: AudioPlayerProps): JSX.Element {
  const onScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      sync.seekTo(value);
    },
    [sync],
  );

  const progressPct = useMemo(() => {
    if (!sync.duration || sync.duration <= 0) return 0;
    return Math.min(100, (sync.currentTime / sync.duration) * 100);
  }, [sync.currentTime, sync.duration]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 18px",
        borderRadius: 18,
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-soft)",
      }}
    >
      <audio
        ref={sync.audioRef}
        src={audioUrl}
        onTimeUpdate={sync.onTimeUpdate}
        onLoadedMetadata={sync.onLoadedMetadata}
        onPlay={sync.onPlay}
        onPause={sync.onPause}
        onEnded={sync.onEnded}
        preload="metadata"
        style={{ display: "none" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="primary"
          size="md"
          onClick={sync.togglePlay}
          aria-label={sync.isPlaying ? "Pausar" : "Reproducir"}
        >
          {sync.isPlaying ? "Pausar" : "Reproducir"}
        </Button>

        <span
          style={{
            fontFamily:
              "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontSize: 13,
            color: "var(--color-text)",
            minWidth: 110,
            textAlign: "right" as const,
          }}
          aria-live="off"
        >
          {formatDuration(sync.currentTime)} /{" "}
          {formatDuration(sync.duration)}
        </span>

        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="range"
            min={0}
            max={Math.max(sync.duration, 0.001)}
            step={0.05}
            value={Math.min(sync.currentTime, sync.duration || 0)}
            onChange={onScrub}
            aria-label="Posición del audio"
            style={{
              width: "100%",
              accentColor: "var(--color-lime)",
              cursor: "pointer",
            }}
          />
          <div
            aria-hidden="true"
            role="presentation"
            style={{
              height: 3,
              borderRadius: 999,
              marginTop: -4,
              background: `linear-gradient(to right, var(--color-lime) ${progressPct}%, var(--color-border) ${progressPct}%)`,
            }}
          />
        </div>

        <select
          value={sync.playbackRate}
          onChange={(e) => sync.setPlaybackRate(Number(e.target.value))}
          aria-label="Velocidad de reproducción"
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 13,
            background: "var(--color-bg)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          {PLAYBACK_RATES.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "var(--color-text-dim)",
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          letterSpacing: "0.4px",
        }}
      >
        Tip: clickeá una línea del transcript para saltar al momento exacto.
      </p>
    </div>
  );
}
