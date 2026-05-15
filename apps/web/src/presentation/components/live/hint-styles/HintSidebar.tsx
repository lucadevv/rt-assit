"use client";

/**
 * HintSidebar — compact list with timestamps. Optimised for note-style
 * follow-along where you're scanning past hints.
 */

import type { JSX } from "react";
import { useSessionStore } from "@/application/stores/session.store";
import {
  useAgentStore,
  selectIsThinking,
} from "@/application/stores/agent.store";
import { ScribeMarkdown } from "./ScribeMarkdown";

function formatHHMM(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function HintSidebar(): JSX.Element {
  const hints = useSessionStore((s) => s.hints);
  const mode = useSessionStore((s) => s.session?.mode ?? "agent");
  const currentResponse = useAgentStore((s) => s.currentResponse);
  const isThinking = useAgentStore(selectIsThinking);
  const isScribe = mode === "scribe";

  if (hints.length === 0 && !currentResponse && !isThinking) {
    return (
      <div
        style={{
          color: "var(--color-text-dim)",
          fontStyle: "italic",
          padding: 16,
          fontSize: 13,
        }}
      >
        Sugerencias en tiempo real aparecerán acá.
      </div>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {hints.map((hint) => (
        <li
          key={hint.id ?? hint.timestampMs}
          style={{
            display: "flex",
            gap: 12,
            padding: "10px 0",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span
            style={{
              flex: "0 0 56px",
              fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
              fontSize: 11,
              color: "var(--color-text-dim)",
              fontWeight: 700,
              letterSpacing: "0.6px",
              paddingTop: 2,
            }}
          >
            {formatHHMM(hint.timestampMs)}
          </span>
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--color-text)",
              whiteSpace: isScribe ? "normal" : "pre-wrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {isScribe ? (
              <ScribeMarkdown content={hint.content} />
            ) : (
              hint.content
            )}
          </span>
        </li>
      ))}
      {currentResponse || isThinking ? (
        <li
          style={{
            display: "flex",
            gap: 12,
            padding: "10px 0",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-bg-soft)",
            borderRadius: 8,
          }}
        >
          <span
            style={{
              flex: "0 0 56px",
              fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
              fontSize: 11,
              color: "var(--color-lime-ink)",
              fontWeight: 700,
              letterSpacing: "0.6px",
              paddingTop: 2,
            }}
          >
            ahora
          </span>
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--color-text)",
              whiteSpace: isScribe && currentResponse ? "normal" : "pre-wrap",
              fontStyle: currentResponse ? "normal" : "italic",
              flex: 1,
              minWidth: 0,
            }}
          >
            {currentResponse ? (
              isScribe ? (
                <ScribeMarkdown content={currentResponse} />
              ) : (
                currentResponse
              )
            ) : (
              "Pensando…"
            )}
          </span>
        </li>
      ) : null}
    </ul>
  );
}
