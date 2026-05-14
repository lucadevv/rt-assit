/**
 * Auri spacing scale (px).
 * 4px base step, follows the visual system in the Auri brief.
 */

export const spacing = {
  px0: 0,
  px4: 4,
  px8: 8,
  px12: 12,
  px16: 16,
  px20: 20,
  px24: 24,
  px32: 32,
  px40: 40,
  px48: 48,
  px56: 56,
  px64: 64,
  px80: 80,
  px96: 96,
  px128: 128,
} as const;

export type SpacingTokens = typeof spacing;
