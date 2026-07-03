/**
 * Susurra color palette — LIGHT-only (Camino C).
 *
 * Brand tokens (carbon / coral / ivory / sand) mirror apps/landing and the
 * brand book (design_susurra/brand_guidelines_v1.html). Legacy
 * lime/cyan/amber/lavender/hero keys are preserved as compatibility shims
 * so primitives (Pill, Button, Card, StatCard) keep rendering without a
 * per-file rewrite — values are rebranded onto the Susurra surface tones.
 *
 * Backend ScenarioColor mapping is preserved:
 *   cyan     -> interview_dev
 *   amber    -> meeting_business / sales_call
 *   lavender -> exam_oral / thesis_defense
 *   lime     -> personal / brand accent (now coral)
 */

export const colors = {
  // -----------------------------------------------------------------
  // Susurra brand palette (canonical)
  // -----------------------------------------------------------------
  carbon: "#1A1A24",
  carbonSmoke: "#2C2A3A",
  coral: "#FF7B5C",
  coralDeep: "#E55A3F",
  coralSoft: "rgba(255, 123, 92, 0.10)",
  ivory: "#F5EFE6",
  ivoryWarm: "#FAF6EF",
  sand: "#B8A89A",

  // Semantic
  background: "#F5EFE6",
  foreground: "#1A1A24",
  muted: "rgba(26, 26, 36, 0.65)",
  subtle: "rgba(26, 26, 36, 0.45)",
  border: "rgba(26, 26, 36, 0.08)",
  borderStrong: "rgba(26, 26, 36, 0.16)",

  // Legacy primary/secondary aliases
  primary: "#FF7B5C",
  primaryHover: "#E55A3F",

  // Danger — semantic red for invalid inputs, delete actions, errors
  danger: "oklch(58% 0.22 25)",
  dangerSoft: "oklch(58% 0.22 25 / 0.1)",

  // -----------------------------------------------------------------
  // Legacy hero gradient — rebranded onto carbon tones (still used by
  // .susurra-hero-gradient and HeroBanner).
  // -----------------------------------------------------------------
  hero: {
    h0: "#1A1A24",
    h1: "#2C2A3A",
    h2: "#3A3548",
  },

  // -----------------------------------------------------------------
  // Legacy accent aliases — preserved so Pill/Button/StatCard variants
  // (lime / cyan / amber / lavender) keep working. Values rebranded
  // onto Susurra surface tones to harmonize.
  // -----------------------------------------------------------------
  lime: "#FF7B5C",
  limeInk: "#FFFFFF",

  cyan: "#E9DFD1",
  cyanInk: "#2C2A3A",
  amber: "#FFE1D6",
  amberInk: "#7A2A14",
  lavender: "#EFE6DD",
  lavenderInk: "#2C2A3A",

  // Legacy neutrals — kept under `light.*` for any caller still
  // reaching into `colors.light.<tok>` (e.g. Logo.tsx). LIGHT only —
  // the previous `dark.*` block was removed when dark mode was retired.
  light: {
    bg: "#F5EFE6",
    bgSoft: "#FAF6EF",
    bgWarm: "#FAF6EF",
    black: "#1A1A24",
    border: "rgba(26, 26, 36, 0.08)",
    text: "#1A1A24",
    textMid: "rgba(26, 26, 36, 0.65)",
    textDim: "rgba(26, 26, 36, 0.45)",
  },
} as const;

// Map backend ScenarioColor strings to actual values. The same names are
// preserved (cyan/amber/lavender/lime) so the wire contract stays stable;
// the visual values are now harmonized with the Susurra surface palette.
export const scenarioColorMap = {
  cyan: { fg: colors.cyan, ink: colors.cyanInk },
  amber: { fg: colors.amber, ink: colors.amberInk },
  lavender: { fg: colors.lavender, ink: colors.lavenderInk },
  lime: { fg: colors.lime, ink: colors.limeInk },
} as const;

export type ScenarioColorName = keyof typeof scenarioColorMap;
