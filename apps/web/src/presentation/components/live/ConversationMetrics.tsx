"use client";

/**
 * ConversationMetrics — live coaching panel for the user's
 * conversational behaviour during a session.
 *
 * Three signals (silencioso, atento, preciso):
 *   1. Talk ratio — stacked bar (coral = vos, carbon = ellos) with %
 *      labels. Visually intuitive, no spinning chart, no animation
 *      bounce.
 *   2. Ritmo (WPM) — words/minute for the user. Hidden until 20-word
 *      sample so we don't expose noisy early numbers.
 *   3. Monologue alert — fires at 90s of uninterrupted user speech.
 *      Uses the design system's danger-soft token (already used by
 *      other validation surfaces), with a constructive copy line that
 *      tells the user what to do, not just what's wrong.
 *
 * Rendering invariants:
 *   - Returns null until at least one final transcript has arrived (so
 *     it doesn't add visual noise during the pre-capture state).
 *   - Respects `prefers-reduced-motion`: bar width still animates (the
 *     ratio is the value, not a decoration), but the entrance fade is
 *     skipped. The monologue alert also skips its enter animation.
 *   - tabular-nums on numeric values so the displayed number doesn't
 *     visually jitter as widths change between e.g. "9" and "10".
 *   - a11y: the bar has an aria-label summary of the ratio; the alert
 *     uses role=status + aria-live=polite so screen readers announce
 *     it without grabbing focus.
 */

import type { JSX } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  useMonologueAlert,
  useMonologueDurationSec,
  useTalkRatio,
  useYouWpm,
} from "@/application/stores/metrics.selectors";
import { easeOut } from "@/lib/motion-presets";

export function ConversationMetrics(): JSX.Element | null {
  const { youPercent, themPercent, total } = useTalkRatio();
  const wpm = useYouWpm();
  const monologue = useMonologueAlert();
  const monologueSec = useMonologueDurationSec();
  const shouldReduceMotion = useReducedMotion();

  // Don't render anything until at least one final transcript has been
  // counted — there's nothing useful to show during the empty state.
  if (total === 0) return null;

  // For the stacked bar, render the EXACT integer percentages so the
  // visual matches the labels. If they sum to 99 or 101 (rounding
  // edge) the bar will be slightly under/over by 1px — acceptable, and
  // less confusing than re-allocating one side's percent to make them
  // sum exactly.
  const youWidth = `${youPercent}%`;
  const themWidth = `${themPercent}%`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        background: "var(--color-bg-soft)",
        borderRadius: 14,
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card-1)",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-text-dim)",
          fontWeight: 700,
        }}
      >
        Tu conversación
      </div>

      {/* Talk ratio --------------------------------------------------- */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--color-text-mid)",
            marginBottom: 6,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>Vos {youPercent}%</span>
          <span>Ellos {themPercent}%</span>
        </div>
        <div
          role="img"
          aria-label={`Talk ratio: vos hablás ${youPercent}%, ellos hablan ${themPercent}%`}
          style={{
            height: 6,
            borderRadius: 999,
            background: "var(--color-border)",
            overflow: "hidden",
            display: "flex",
          }}
        >
          <motion.div
            initial={shouldReduceMotion ? false : { width: 0 }}
            animate={{ width: youWidth }}
            transition={{ duration: 0.3, ease: easeOut }}
            style={{
              background: "var(--color-coral)",
              height: "100%",
            }}
          />
          <motion.div
            initial={shouldReduceMotion ? false : { width: 0 }}
            animate={{ width: themWidth }}
            transition={{ duration: 0.3, ease: easeOut }}
            style={{
              background: "var(--color-carbon)",
              height: "100%",
            }}
          />
        </div>
      </div>

      {/* WPM ---------------------------------------------------------- */}
      {wpm !== null ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            color: "var(--color-text)",
          }}
        >
          <span style={{ color: "var(--color-text-mid)" }}>Ritmo</span>
          <span
            style={{
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {wpm}{" "}
            <span
              style={{
                fontSize: 10,
                color: "var(--color-text-mid)",
                fontWeight: 400,
              }}
            >
              palabras/min
            </span>
          </span>
        </div>
      ) : null}

      {/* Monologue alert --------------------------------------------- */}
      {monologue && monologueSec !== null ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: easeOut }}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--color-danger-soft)",
            border:
              "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
            fontSize: 12,
            color: "var(--color-danger)",
            lineHeight: 1.4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Llevás {monologueSec}s hablando solo. Dejá espacio para preguntas.
        </motion.div>
      ) : null}
    </div>
  );
}
