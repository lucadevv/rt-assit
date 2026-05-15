/**
 * Susurra color palette — OKLCH for perceptual uniformity.
 * All colors scoped by theme (light/dark) and semantic role.
 *
 * Backend ScenarioColor mapping (B3):
 *   cyan     -> interview_dev
 *   amber    -> meeting_business / sales_call
 *   lavender -> exam_oral / thesis_defense
 *   lime     -> personal / brand accent
 */

export const colors = {
  // Hero gradient (deep purple -> violet)
  hero: {
    h0: "oklch(24% 0.18 290)",
    h1: "oklch(36% 0.22 285)",
    h2: "oklch(48% 0.24 280)",
  },

  // Brand accent (CTA + interactive)
  lime: "oklch(82% 0.24 130)",
  limeInk: "oklch(22% 0.12 130)",

  // Scenario accents (mapped to backend ScenarioColor)
  cyan: "oklch(86% 0.11 205)",
  cyanInk: "oklch(28% 0.10 220)",
  amber: "oklch(82% 0.16 75)",
  amberInk: "oklch(28% 0.13 70)",
  lavender: "oklch(80% 0.12 295)",
  lavenderInk: "oklch(28% 0.14 295)",

  // Neutrals (light theme)
  light: {
    bg: "#ffffff",
    bgSoft: "oklch(96% 0.02 295)",
    bgWarm: "oklch(97% 0.012 80)",
    black: "oklch(14% 0.01 285)",
    border: "oklch(91% 0.012 290)",
    text: "oklch(16% 0.012 285)",
    textMid: "oklch(46% 0.018 285)",
    textDim: "oklch(64% 0.014 285)",
  },

  // Neutrals (dark theme)
  dark: {
    bg: "oklch(13% 0.02 285)",
    bg2: "oklch(15% 0.022 285)",
    bg3: "oklch(18% 0.025 285)",
    border: "oklch(24% 0.04 285)",
    text: "oklch(96% 0.01 285)",
    textMid: "oklch(68% 0.02 285)",
    textDim: "oklch(48% 0.02 285)",
  },
} as const;

// Map backend ScenarioColor strings to actual OKLCH values
export const scenarioColorMap = {
  cyan: { fg: colors.cyan, ink: colors.cyanInk },
  amber: { fg: colors.amber, ink: colors.amberInk },
  lavender: { fg: colors.lavender, ink: colors.lavenderInk },
  lime: { fg: colors.lime, ink: colors.limeInk },
} as const;

export type ScenarioColorName = keyof typeof scenarioColorMap;
