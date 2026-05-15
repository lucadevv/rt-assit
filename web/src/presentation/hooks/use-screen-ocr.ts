"use client";

import { useEffect, useRef } from "react";
import { useScreenOcrStore } from "@/application/stores/screen-ocr.store";
import { TesseractAdapter } from "@/infrastructure/ocr/tesseract-adapter";
import { ExtractScreenTextUseCase } from "@/application/use-cases/extract-screen-text";

const THROTTLE_MS = 5000;
// Mirrors the backend's confidence floor in
// app.application.services.transcript_session_state.SCREEN_TEXT_MIN_CONFIDENCE.
// Pre-filtering here avoids paying the WS round-trip for extractions
// the backend would discard anyway.
const MIN_EMIT_CONFIDENCE = 0.5;

/**
 * useScreenOcr — captures a frame from the given MediaStream every
 * THROTTLE_MS, extracts text via Tesseract.js, and pushes diffed
 * results to the screen-ocr store. No-ops while `enabled === false`
 * or when the stream has no live video tracks.
 *
 * G2: on every NEW valid extraction we ALSO forward the payload via
 * the screen-ocr store's `sink` (installed by useLiveSession on
 * start). The sink wraps `AgentStreamPort.sendScreenText` so the
 * backend stores the text in the per-session state and threads it
 * into the next prompt build.
 *
 * Lazy initialisation: the Tesseract worker (WASM + lang data) only
 * downloads on the FIRST extraction call. Subsequent calls reuse it.
 *
 * The hook owns a hidden, off-screen <video> element bound to the
 * stream. drawImage() needs something to draw FROM, and using the
 * raw track via ImageCapture is patchy across browsers — a video tag
 * is the boring, reliable path.
 */
export function useScreenOcr(stream: MediaStream | null): void {
  const enabled = useScreenOcrStore((s) => s.enabled);
  const push = useScreenOcrStore((s) => s.push);

  // Refs so the worker survives re-renders without rebuilding.
  const adapterRef = useRef<TesseractAdapter | null>(null);
  const useCaseRef = useRef<ExtractScreenTextUseCase | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !stream) return;
    const hasVideo = stream
      .getVideoTracks()
      .some((t) => t.readyState === "live");
    if (!hasVideo) return;

    // Build adapter + use case lazily on first activation.
    if (!adapterRef.current) {
      adapterRef.current = new TesseractAdapter();
      useCaseRef.current = new ExtractScreenTextUseCase(adapterRef.current);
    }

    // Hidden, off-screen video element to feed drawImage().
    const video = document.createElement("video");
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.width = "1px";
    video.style.height = "1px";
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    document.body.appendChild(video);
    video.play().catch(() => undefined);
    videoRef.current = video;

    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled) return;
      const uc = useCaseRef.current;
      const v = videoRef.current;
      if (!uc || !v || v.videoWidth === 0) return;
      try {
        const result = await uc.execute(v);
        if (cancelled) return;
        if (result.isNew) {
          const entry = {
            text: result.text,
            confidence: result.confidence,
            capturedAt: Date.now(),
          };
          push(entry);
          // G2 — forward to the backend via the sink registered by
          // useLiveSession. Mirror the backend's confidence + emptiness
          // filter so we don't waste WS bandwidth on extractions that
          // would be rejected. Wrapped in try/catch: a sink failure
          // (closed WS, unexpected exception) MUST NEVER break OCR.
          if (
            entry.text.trim().length > 0 &&
            entry.confidence >= MIN_EMIT_CONFIDENCE
          ) {
            const sink = useScreenOcrStore.getState().sink;
            if (sink) {
              try {
                sink(entry);
              } catch (sinkErr) {
                // eslint-disable-next-line no-console
                console.warn("[Susurra OCR] sink emit failed", sinkErr);
              }
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Susurra OCR] extraction failed", err);
      }
    };

    // Fire one immediately + then on interval.
    void tick();
    intervalRef.current = setInterval(() => void tick(), THROTTLE_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, [enabled, stream, push]);

  // Dispose Tesseract worker on full unmount.
  useEffect(() => {
    return () => {
      void adapterRef.current?.dispose();
      useCaseRef.current?.reset();
      adapterRef.current = null;
      useCaseRef.current = null;
    };
  }, []);
}
