/**
 * Auri elevation tokens.
 * Subtle elevation (Auri uses light shadows + borders, not heavy drop shadows).
 */

export const shadows = {
  none: "none",
  xs: "0 1px 2px rgba(20, 20, 30, 0.04)",
  sm: "0 1px 3px rgba(20, 20, 30, 0.06), 0 1px 2px rgba(20, 20, 30, 0.04)",
  md: "0 4px 8px rgba(20, 20, 30, 0.06), 0 2px 4px rgba(20, 20, 30, 0.04)",
  lg: "0 12px 24px rgba(20, 20, 30, 0.08), 0 4px 8px rgba(20, 20, 30, 0.05)",
  xl: "0 24px 48px rgba(20, 20, 30, 0.12), 0 8px 16px rgba(20, 20, 30, 0.06)",
  focusRing: "0 0 0 3px oklch(82% 0.24 130 / 0.4)",
} as const;

export type ShadowTokens = typeof shadows;
