/**
 * Susurra typography scale — DM Sans + JetBrains Mono.
 * Display 54 / H1 38 / H2 24 / Body 16 / Caption 13 / Pill 11 / Mono 13.
 */

export const typography = {
  fontFamily: {
    sans: "var(--font-dm-sans), system-ui, -apple-system, sans-serif",
    mono: "var(--font-jetbrains), ui-monospace, SFMono-Regular, monospace",
  },
  fontSize: {
    display: "54px",
    h1: "38px",
    h2: "24px",
    h3: "18px",
    bodyL: "16px",
    body: "14px",
    caption: "13px",
    pill: "11px",
    mono: "13px",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800,
  },
  letterSpacing: {
    display: "-2.2px",
    h1: "-1.4px",
    h2: "-0.5px",
    body: "0",
    mono: "1.2px",
    pill: "0.6px",
  },
  lineHeight: {
    tight: 1.04,
    snug: 1.05,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const;

export type TypographyTokens = typeof typography;
