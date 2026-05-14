"use client";

/**
 * HintChat — chat-style stack of agent messages with a small "Auri" avatar.
 * The in-flight response renders as the final bubble with a blinking cursor.
 */

import type { JSX } from "react";
import { useSessionStore } from "@/application/stores/session.store";
import {
  useAgentStore,
  selectIsThinking,
} from "@/application/stores/agent.store";
import { ScribeMarkdown } from "./ScribeMarkdown";

function AuriAvatar(): JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: 9999,
        background: "var(--color-lime)",
        color: "var(--color-lime-ink)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.6px",
        flex: "0 0 auto",
      }}
    >
      A
    </div>
  );
}

export function HintChat(): JSX.Element {
  const hints = useSessionStore((s) => s.hints);
  const mode = useSessionStore((s) => s.session?.mode ?? "agent");
  const currentResponse = useAgentStore((s) => s.currentResponse);
  const isThinking = useAgentStore(selectIsThinking);

  const allEmpty = hints.length === 0 && !currentResponse && !isThinking;
  const isScribe = mode === "scribe";

  if (allEmpty) {
    return (
      <div
        style={{
          color: "var(--color-text-dim)",
          fontStyle: "italic",
          padding: 24,
          textAlign: "center",
          fontSize: 14,
        }}
      >
        {isScribe
          ? "Auri va a tomar notas estructuradas durante la reunión."
          : "Auri va a chatear con vos en tiempo real durante la conversación."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {hints.map((hint) => (
        <div
          key={hint.id ?? hint.timestampMs}
          style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <AuriAvatar />
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 18,
              background: "var(--color-bg-soft)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              fontSize: 13,
              lineHeight: 1.55,
              maxWidth: "85%",
              whiteSpace: isScribe ? "normal" : "pre-wrap",
            }}
          >
            {isScribe ? (
              <ScribeMarkdown content={hint.content} />
            ) : (
              hint.content
            )}
          </div>
        </div>
      ))}
      {currentResponse || isThinking ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AuriAvatar />
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 18,
              background: "var(--color-lime)",
              color: "var(--color-lime-ink)",
              border: "1px solid transparent",
              fontSize: 13,
              lineHeight: 1.55,
              maxWidth: "85%",
              whiteSpace: isScribe ? "normal" : "pre-wrap",
            }}
          >
            {currentResponse ? (
              isScribe ? (
                <ScribeMarkdown content={currentResponse} />
              ) : (
                currentResponse
              )
            ) : isThinking ? (
              "Pensando…"
            ) : (
              ""
            )}
            {currentResponse ? (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 14,
                  marginLeft: 4,
                  background: "currentColor",
                  verticalAlign: "text-bottom",
                  animation: "auri-rec-pulse 0.9s steps(2) infinite",
                  opacity: 0.7,
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
