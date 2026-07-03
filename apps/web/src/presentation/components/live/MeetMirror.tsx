"use client";

/**
 * MeetMirror — live <video> preview of the captured tab (Meet/Zoom/Teams Web).
 *
 * The MediaStream comes from the session store (`currentStream`), populated
 * by the capture adapter's `onStream` callback. The adapter always keeps
 * video tracks alive (keepVideo=true) so layout switches mid-session work
 * without a Stop+Start round trip.
 *
 * The <video> element is forcibly muted — playback already comes from the
 * original tab; routing it through this element would echo.
 *
 * Three rendering states:
 *  1. No stream                        → idle placeholder Card.
 *  2. Stream with zero video tracks    → "restart needed" hint Card
 *                                        (legacy capture started before
 *                                        keepVideo became unconditional).
 *  3. Stream with video tracks         → live <video srcObject>.
 *
 * The video-track presence is observed via the MediaStream `addtrack` /
 * `removetrack` events so dynamic changes (e.g. user revoked video share)
 * also propagate to the UI without a manual refresh.
 */

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/design-system/primitives";

interface MeetMirrorProps {
  stream: MediaStream | null;
}

function streamHasVideo(stream: MediaStream | null): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((t) => t.readyState === "live");
}

export function MeetMirror({ stream }: MeetMirrorProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState<boolean>(() =>
    streamHasVideo(stream),
  );

  // Track video-track presence reactively — addtrack/removetrack fire when
  // the underlying tab's video share changes mid-session.
  useEffect(() => {
    setHasVideo(streamHasVideo(stream));
    if (!stream) return;
    const recheck = (): void => setHasVideo(streamHasVideo(stream));
    stream.addEventListener("addtrack", recheck);
    stream.addEventListener("removetrack", recheck);
    return () => {
      stream.removeEventListener("addtrack", recheck);
      stream.removeEventListener("removetrack", recheck);
    };
  }, [stream]);

  // Attach the stream to the <video> element only when we have video.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream && hasVideo) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      void video.play().catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn("[MeetMirror] play() rejected:", err);
      });
    } else {
      video.srcObject = null;
    }
    return () => {
      if (video) video.srcObject = null;
    };
  }, [stream, hasVideo]);

  // -------------------- State 1: idle (no stream) --------------------
  if (!stream) {
    return (
      <Card
        variant="soft"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 280,
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "var(--color-text-mid)",
            fontSize: 13,
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 360,
          }}
        >
          Iniciá la captura para ver el preview en vivo de tu reunión acá.
        </p>
      </Card>
    );
  }

  // -------------------- State 2: stream without video --------------------
  if (!hasVideo) {
    return (
      <Card
        variant="soft"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 280,
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "var(--color-text-mid)",
            fontSize: 13,
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 380,
          }}
        >
          Esta sesión se inició sin video. Detené y reiniciá la captura para
          activar el preview en vivo.
        </p>
      </Card>
    );
  }

  // -------------------- State 3: stream with video --------------------
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 18,
        overflow: "hidden",
        background: "#000",
        aspectRatio: "16 / 9",
        border: "1px solid var(--color-border)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "rgba(0, 0, 0, 0.6)",
          color: "#fff",
          padding: "4px 10px",
          borderRadius: 50,
          fontSize: 11,
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--color-danger)",
            boxShadow: "0 0 6px color-mix(in srgb, var(--color-danger) 90%, transparent)",
          }}
        />
        Live · Mirror
      </span>
    </div>
  );
}
