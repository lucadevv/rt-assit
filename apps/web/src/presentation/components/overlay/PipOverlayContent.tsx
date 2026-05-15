"use client";

/**
 * PipOverlayContent — the React tree rendered INSIDE the document
 * Picture-in-Picture window. Two states:
 *   - Idle: there is no live session — show a pill with a "Iniciar sesión"
 *     CTA so the user can start from the floating overlay.
 *   - Live: there IS a live session — show transcript + agent response +
 *     REC badge with the scenario color border.
 *
 * IMPORTANT: this component is rendered into a different `Document` than
 * the host page. Tailwind classes from the parent app DO NOT apply (the PiP
 * window has its own style scope). The adapter injects a minimal CSS bundle
 * that exposes `--susurra-*` custom properties; everything here uses inline
 * styles + those vars. Do NOT add Tailwind utilities.
 */

import type { CSSProperties, JSX } from "react";
import type { OverlaySnapshot } from "@/infrastructure/pip/constants";
import type { ScenarioColor } from "@/domain/entities/scenario";

interface Props {
  snapshot: OverlaySnapshot;
  onStart: () => void;
  onStop: () => void;
}

const colorVarFor: Record<ScenarioColor, string> = {
  cyan: "var(--susurra-cyan)",
  amber: "var(--susurra-amber)",
  lavender: "var(--susurra-lavender)",
  lime: "var(--susurra-lime)",
};

export function PipOverlayContent({
  snapshot,
  onStart,
  onStop,
}: Props): JSX.Element {
  if (!snapshot.isLive) {
    return <PipIdleState onStart={onStart} />;
  }
  return <PipLiveState snapshot={snapshot} onStop={onStop} />;
}

// ---------------------------------------------------------------------------
// Idle state — no live session.
// ---------------------------------------------------------------------------

function PipIdleState({ onStart }: { onStart: () => void }): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        gap: 14,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: "var(--susurra-text-mid)",
          padding: "4px 10px",
          border: "1px solid var(--susurra-border)",
          borderRadius: 9999,
        }}
      >
        Susurra · idle
      </span>
      <h1
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.3px",
          color: "var(--susurra-text)",
        }}
      >
        Listo para escuchar
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--susurra-text-mid)",
          maxWidth: 320,
        }}
      >
        Cuando inicies una sesión, vas a ver acá la transcripción y la
        respuesta de Susurra en vivo.
      </p>
      <button
        type="button"
        onClick={onStart}
        style={{
          background: "var(--susurra-lime)",
          color: "var(--susurra-lime-ink)",
          border: "none",
          padding: "11px 22px",
          borderRadius: 50,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        Iniciar sesión
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live state — there is an active session.
// ---------------------------------------------------------------------------

function PipLiveState({
  snapshot,
  onStop,
}: {
  snapshot: OverlaySnapshot;
  onStop: () => void;
}): JSX.Element {
  const accent = colorVarFor[snapshot.scenarioColor];

  const cardStyle: CSSProperties = {
    flex: 1,
    margin: 8,
    display: "flex",
    flexDirection: "column",
    border: `2px solid ${accent}`,
    borderRadius: 14,
    overflow: "hidden",
    background: "var(--susurra-bg)",
    minHeight: 0,
  };

  return (
    <div style={cardStyle}>
      <header
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--susurra-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--susurra-bg-soft)",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 11,
            fontWeight: 800,
            color: accent,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
            }}
          />
          REC · {formatDuration(snapshot.durationSeconds)}
        </span>
        <button
          type="button"
          onClick={onStop}
          style={{
            background: "transparent",
            color: "var(--susurra-text-mid)",
            border: "1px solid var(--susurra-border)",
            padding: "4px 12px",
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.4px",
            cursor: "pointer",
          }}
        >
          Detener
        </button>
      </header>

      {/* Transcript section */}
      <section
        style={{
          flex: 1,
          minHeight: 0,
          padding: "12px 14px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 9,
            fontWeight: 800,
            color: "var(--susurra-text-dim)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 6,
          }}
        >
          Transcripción
        </div>
        {snapshot.transcript ? (
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: snapshot.transcript.isFinal
                ? "var(--susurra-text)"
                : "var(--susurra-text-mid)",
              fontStyle: snapshot.transcript.isFinal ? "normal" : "italic",
            }}
          >
            {snapshot.transcript.speakerLabel ? (
              <span
                style={{
                  color: accent,
                  fontSize: 10,
                  fontWeight: 800,
                  marginRight: 6,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  letterSpacing: "0.4px",
                }}
              >
                [{snapshot.transcript.speakerLabel}]
              </span>
            ) : null}
            {snapshot.transcript.content}
          </div>
        ) : (
          <p
            style={{
              fontSize: 12,
              color: "var(--susurra-text-dim)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            Esperando audio...
          </p>
        )}
      </section>

      {/* Response section */}
      <section
        style={{
          padding: "12px 14px",
          borderTop: "1px solid var(--susurra-border)",
          background: "var(--susurra-bg-soft)",
          flexShrink: 0,
          maxHeight: "45%",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: 9,
            fontWeight: 800,
            color: "var(--susurra-text-dim)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 6,
          }}
        >
          Susurra
        </div>
        {snapshot.isThinking && !snapshot.currentResponse ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--susurra-text-mid)",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            Pensando...
          </p>
        ) : null}
        {snapshot.currentResponse ? (
          <p
            style={{
              fontSize: 14,
              color: "var(--susurra-text)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {snapshot.currentResponse}
          </p>
        ) : null}
        {!snapshot.currentResponse &&
        !snapshot.isThinking &&
        snapshot.lastResponse ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--susurra-text-mid)",
              margin: 0,
              opacity: 0.85,
              lineHeight: 1.5,
            }}
          >
            {snapshot.lastResponse}
          </p>
        ) : null}
        {!snapshot.currentResponse &&
        !snapshot.isThinking &&
        !snapshot.lastResponse ? (
          <p
            style={{
              fontSize: 12,
              color: "var(--susurra-text-dim)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            Sin respuestas todavía.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function formatDuration(s: number): string {
  const safe = Math.max(0, Math.floor(s));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const sec = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}
