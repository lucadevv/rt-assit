# @susurra/tokens

Susurra brand design tokens — colors, fonts, radii, shadows.

Source of truth: `design_susurra/brand_guidelines_v1.html`.

## Consumption

```ts
import { colors, fonts } from '@susurra/tokens';

const heroBg = colors.carbon;
```

For Tailwind v3-style consumption, import the preset:

```ts
import { susurraPreset } from '@susurra/tokens/tailwind-preset';

export default {
  presets: [susurraPreset],
  // ...
};
```

For Tailwind v4 (CSS-first), import the tokens directly into `globals.css`
via CSS variables — see `apps/landing/src/app/globals.css` for the pattern.
