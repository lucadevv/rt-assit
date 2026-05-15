"use client";

/**
 * MeetingInfoCard — Sprint 1.5.
 *
 * Renders at the top of /app/live when the loaded session has a meeting
 * associated (via `session.meetingUrl`). Surfaces the join URL with a soft
 * coral accent + 2 quick actions:
 *   - [Abrir Meet]  → opens the URL in a new tab.
 *   - [Copiar link] → copies the URL to clipboard.
 *
 * The footer copy reminds the user how Susurra captures the audio: they
 * need to share the Meet tab via tab-share for Susurra to listen
 * (TabShareAudioStrategy is the only one wired in Sprint 1.5).
 */

import { useCallback, useState } from "react";
import type { JSX } from "react";
import { Button, Card } from "@/design-system/primitives";
import { MonitorIcon } from "@/design-system/icons";

export interface MeetingInfoCardProps {
  /** Join URL of the associated meeting (e.g. https://meet.google.com/abc-defg-hij). */
  meetingUrl: string;
  /** Optional human-readable code (e.g. `abc-defg-hij`). Falls back to the URL when null. */
  meetingCode: string | null;
}

export function MeetingInfoCard({
  meetingUrl,
  meetingCode,
}: MeetingInfoCardProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(meetingUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Non-secure context: clipboard write may fail. The URL is visible
      // in the card so the user can still copy it manually.
    }
  }, [meetingUrl]);

  const handleOpen = useCallback((): void => {
    if (typeof window === "undefined") return;
    window.open(meetingUrl, "_blank", "noopener,noreferrer");
  }, [meetingUrl]);

  const display = meetingCode ?? prettyHost(meetingUrl);

  return (
    <Card
      variant="warm"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: 14,
        // Coral accent — softer than the alert color, prominent without
        // screaming.
        borderColor:
          "color-mix(in oklab, var(--color-coral, oklch(70% 0.18 25)) 35%, var(--color-border))",
        background:
          "color-mix(in oklab, var(--color-coral, oklch(70% 0.18 25)) 8%, var(--color-bg))",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-coral, oklch(70% 0.18 25))",
          flexShrink: 0,
        }}
      >
        <MonitorIcon size={18} />
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          Reunión asociada
        </span>
        <span
          className="mono"
          style={{
            fontSize: 13,
            color: "var(--color-text-mid)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {display}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-mid)",
            marginTop: 2,
          }}
        >
          Compartí el tab de Meet para que Susurra te escuche
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexShrink: 0,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <Button variant="primary" size="sm" onClick={handleOpen}>
          Abrir Meet
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void handleCopy();
          }}
        >
          {copied ? "¡Copiado!" : "Copiar link"}
        </Button>
      </div>
    </Card>
  );
}

function prettyHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
