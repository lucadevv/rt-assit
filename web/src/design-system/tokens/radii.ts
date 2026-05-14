/**
 * Auri border radius tokens.
 * Cards rounded-3xl (~22px), pills rounded-full, buttons 50px (full pill).
 */

export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 50,
  full: 9999,
} as const;

export type RadiiTokens = typeof radii;
