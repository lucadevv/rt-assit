"use client";

/**
 * HintCards — primary hint as a large StatCard-like fill, contextual hints
 * as smaller sibling cards below.
 */

import type { JSX } from "react";
import { Card } from "@/design-system/primitives";
import { useSessionStore } from "@/application/stores/session.store";
import {
  useAgentStore,
  selectIsThinking,
} from "@/application/stores/agent.store";
import { ScribeMarkdown } from "./ScribeMarkdown";

export function HintCards(): JSX.Element {
  const hints = useSessionStore((s) => s.hints);
  // `mode` lives on the session row — we read it from the store so the
  // markdown branch turns on/off when the user creates a new session of
  // a different mode without remounting the live page.
  const mode = useSessionStore((s) => s.session?.mode ?? "agent");
  const isThinking = useAgentStore(selectIsThinking);
  const currentResponse = useAgentStore((s) => s.currentResponse);

  const live = currentResponse;
  const past = [...hints].reverse();
  const primary = live || past[0]?.content || null;
  const contextual = live ? past.slice(0, 2) : past.slice(1, 3);
  const isScribe = mode === "scribe";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card variant="filled" padded>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            opacity: 0.7,
            marginBottom: 8,
          }}
        >
          {isScribe ? "Notas de Auri" : "Auri sugiere"}
        </div>
        {primary ? (
          isScribe ? (
            <div style={{ position: "relative" }}>
              <ScribeMarkdown content={primary} />
              {live ? (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 18,
                    marginLeft: 4,
                    background: "currentColor",
                    verticalAlign: "text-bottom",
                    animation: "auri-rec-pulse 0.9s steps(2) infinite",
                    opacity: 0.7,
                  }}
                />
              ) : null}
            </div>
          ) : (
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                fontWeight: 500,
                whiteSpace: "pre-wrap",
              }}
            >
              {primary}
              {live ? (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 18,
                    marginLeft: 4,
                    background: "currentColor",
                    verticalAlign: "text-bottom",
                    animation: "auri-rec-pulse 0.9s steps(2) infinite",
                    opacity: 0.7,
                  }}
                />
              ) : null}
            </div>
          )
        ) : (
          <div style={{ opacity: 0.7, fontStyle: "italic" }}>
            {isThinking
              ? "Pensando…"
              : isScribe
                ? "Las notas aparecerán acá a medida que avance la reunión."
                : "Las sugerencias aparecerán acá cuando empiece la conversación."}
          </div>
        )}
      </Card>

      {contextual.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {contextual.map((hint) => (
            <Card key={hint.id ?? hint.timestampMs} variant="soft" padded>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.6px",
                  textTransform: "uppercase",
                  color: "var(--color-text-mid)",
                  marginBottom: 6,
                }}
              >
                Anterior
              </div>
              {isScribe ? (
                // Markdown rendering for scribe — no truncation, since the
                // structured note format breaks ugly when sliced mid-bullet.
                <ScribeMarkdown content={hint.content} />
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--color-text)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {hint.content.length > 280
                    ? hint.content.slice(0, 280) + "…"
                    : hint.content}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
