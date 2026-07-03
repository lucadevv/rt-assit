"use client";

/**
 * StepProgress — slim progress indicator at the top of the wizard.
 *
 * Coral fill on carbon background, numeric `n/N` label on the right.
 * Subtle (height: 4px) so it never dominates the content area — the
 * focus is the current step's hero.
 */

import type { JSX } from "react";

interface StepProgressProps {
  current: number;
  total: number;
}

export function StepProgress({ current, total }: StepProgressProps): JSX.Element {
  const percent = Math.min(100, Math.max(0, (current / total) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Paso ${current} de ${total}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 4,
          background: "var(--color-bg-soft)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: "var(--color-coral, #E55A3F)",
            borderRadius: 999,
            transition: "width 320ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.6px",
          color: "var(--color-text-mid)",
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {current}/{total}
      </span>
    </div>
  );
}
