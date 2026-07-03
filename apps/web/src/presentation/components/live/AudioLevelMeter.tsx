"use client";

/**
 * AudioLevelMeter — 16-bar level meter driven by an AnalyserNode reading
 * from the captured MediaStream.
 *
 * Runs in its own AudioContext (separate from the capture pipeline) so the
 * analyser never interferes with the worklet PCM forward. Sampled via
 * `requestAnimationFrame`. RMS-ish: average squared deviation from the
 * neutral 128 byte, scaled to [0, 1].
 *
 * Visual: 16 bars, lime → amber → red as the signal rises.
 */

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

interface AudioLevelMeterProps {
  stream: MediaStream | null;
}

const BAR_COUNT = 16;
const AMBER_THRESHOLD = BAR_COUNT * 0.6;
const RED_THRESHOLD = BAR_COUNT * 0.85;

export function AudioLevelMeter({ stream }: AudioLevelMeterProps): JSX.Element {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      return;
    }

    // Bail out cleanly if the stream has no audio tracks (e.g. mid-stop).
    if (stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }

    // Cast to widen for older lib.dom versions where webkit prefix exists.
    const Ctx: typeof AudioContext =
      typeof window !== "undefined" && "AudioContext" in window
        ? window.AudioContext
        : ((window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext);

    const audioCtx = new Ctx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = (): void => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] ?? 128) - 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length) / 128;
      setLevel(Math.min(1, rms * 2));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        source.disconnect();
      } catch {
        // ignore
      }
      void audioCtx.close().catch(() => undefined);
    };
  }, [stream]);

  const activeBars = Math.round(level * BAR_COUNT);

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 12 }}
      role="meter"
      aria-label="Nivel de audio capturado"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(level.toFixed(2))}
    >
      <span
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 10,
          color: "var(--color-text-dim)",
          letterSpacing: "1px",
          textTransform: "uppercase",
          fontWeight: 700,
          minWidth: 60,
        }}
      >
        Volumen
      </span>
      <div style={{ display: "flex", gap: 2, flex: 1 }} aria-hidden>
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const isActive = i < activeBars;
          let color: string = "var(--color-border)";
          if (isActive) {
            if (i < AMBER_THRESHOLD) color = "var(--color-lime)";
            else if (i < RED_THRESHOLD) color = "var(--color-amber)";
            else color = "var(--color-danger)";
          }
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 14,
                borderRadius: 2,
                background: color,
                transition: "background 80ms",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
