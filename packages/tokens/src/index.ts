// Susurra brand tokens — sourced from design_susurra/brand_guidelines_v1.html
export const colors = {
  carbon: '#1A1A24',       // midnight black, primary text / dark mode
  carbonSmoke: '#2C2A3A',  // softer carbon for elevation/layering
  coral: '#FF7B5C',        // warm coral accent, unique identifier
  coralDeep: '#E55A3F',    // hover states, emphasis
  ivory: '#F5EFE6',        // cream background (60% dominant)
  sand: '#B8A89A',         // warm gray bridge tone
} as const;

export const fonts = {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  serif: ['Instrument Serif', 'Georgia', 'serif'],
  mono: ['JetBrains Mono', 'Menlo', 'monospace'],
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const radii = {
  sm: '0.5rem',
  md: '0.875rem',  // 14px — Susurra's standard
  lg: '1.25rem',
  full: '9999px',
} as const;

export const shadows = {
  soft: '0 6px 20px -6px rgba(26, 26, 36, 0.15)',
  glow: '0 0 80px -20px rgba(255, 123, 92, 0.4)',  // coral glow for hero
} as const;
