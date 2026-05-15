import type { Config } from 'tailwindcss';
import { colors, fonts, fontWeights, radii, shadows } from './index';

export const susurraPreset: Partial<Config> = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: fonts.sans,
        serif: fonts.serif,
        mono: fonts.mono,
      },
      fontWeight: fontWeights as unknown as Record<string, string>,
      borderRadius: radii,
      boxShadow: shadows,
    },
  },
};

export default susurraPreset;
