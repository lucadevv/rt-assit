"use client";

/**
 * HintCards — primary hint as a large StatCard-like fill, contextual hints
 * as smaller sibling cards below.
 */

import type { JSX } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { Card } from "@/design-system/primitives";
import { useSessionStore } from "@/application/stores/session.store";
import {
  useAgentStore,
  selectIsThinking,
} from "@/application/stores/agent.store";
import { ScribeMarkdown } from "./ScribeMarkdown";
import {
  easeOut,
  fadeUpSubtle,
  staggerContainer,
  transitionFast,
} from "@/lib/motion-presets";

export function HintCards(): JSX.Element {
  const hints = useSessionStore((s) => s.hints);
  // `mode` lives on the session row — we read it from the store so the
  // markdown branch turns on/off when the user creates a new session of
  // a different mode without remounting the live page.
  const mode = useSessionStore((s) => s.session?.mode ?? "agent");
  const isThinking = useAgentStore(selectIsThinking);
  const currentResponse = useAgentStore((s) => s.currentResponse);
  const shouldReduceMotion = useReducedMotion();

  const live = currentResponse;
  const past = [...hints].reverse();
  const primary = live || past[0]?.content || null;
  const contextual = live ? past.slice(0, 2) : past.slice(1, 3);
  const isScribe = mode === "scribe";
  // Key the primary card by either the live cycle (stable while streaming)
  // or by the most-recent committed hint id — flips once per response cycle
  // so AnimatePresence fades the new content into place.
  const primaryKey: string = live
    ? "live"
    : past[0]?.id != null
      ? `past-${past[0].id}`
      : past[0]?.timestampMs != null
        ? `past-${past[0].timestampMs}`
        : "empty";

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
          {isScribe ? "Notas de Susurra" : "Susurra sugiere"}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={primaryKey}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: easeOut }}
          >
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
                    animation: "susurra-rec-pulse 0.9s steps(2) infinite",
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
                    animation: "susurra-rec-pulse 0.9s steps(2) infinite",
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
          </motion.div>
        </AnimatePresence>
      </Card>

      {contextual.length > 0 ? (
        <motion.div
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={staggerContainer(0, 0.06)}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {contextual.map((hint) => (
            <motion.div
              key={hint.id ?? hint.timestampMs}
              variants={fadeUpSubtle}
              transition={transitionFast}
            >
            <Card variant="soft" padded>
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
            </motion.div>
          ))}
        </motion.div>
      ) : null}
    </div>
  );
}
