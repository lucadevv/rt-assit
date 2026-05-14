"use client";

/**
 * EmptyStateBanner — small contextual banner used at the top of the Home
 * dashboard to nudge the user when something critical is missing
 * (no CV, no scenario picked, no sessions yet).
 *
 * Always actionable: every banner pairs a one-line message with a CTA so
 * the user never sees a "nothing to see here" dead end.
 *
 * Variants map to the brand fill tokens (cyan, amber, lavender, lime)
 * defined in F0 globals.css. Each variant has a paired ink color so text
 * stays readable on both themes.
 */

import type { JSX } from "react";
import { Button } from "@/design-system/primitives";

type BannerVariant = "cyan" | "amber" | "lavender" | "lime";

interface EmptyStateBannerProps {
  message: string;
  ctaLabel: string;
  onCta: () => void;
  variant?: BannerVariant;
}

const VARIANT_BG: Record<BannerVariant, string> = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
};

const VARIANT_INK: Record<BannerVariant, string> = {
  cyan: "var(--color-cyan-ink)",
  amber: "var(--color-amber-ink)",
  lavender: "var(--color-lavender-ink)",
  lime: "var(--color-lime-ink)",
};

export function EmptyStateBanner({
  message,
  ctaLabel,
  onCta,
  variant = "cyan",
}: EmptyStateBannerProps): JSX.Element {
  return (
    <div
      role="status"
      style={{
        background: VARIANT_BG[variant],
        color: VARIANT_INK[variant],
        borderRadius: 18,
        padding: "14px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <p
        style={{
          fontSize: 14,
          fontWeight: 500,
          margin: 0,
          flex: "1 1 auto",
          minWidth: 240,
        }}
      >
        {message}
      </p>
      <Button variant="dark" size="sm" onClick={onCta}>
        {ctaLabel}
      </Button>
    </div>
  );
}
