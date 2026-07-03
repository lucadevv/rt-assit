# Design

Visual system for Susurra. Strategic context lives in `PRODUCT.md`. This file is the source of truth for tokens, typography, color, motion, and component patterns.

## Theme

**Light, warm-ivory canvas with committed coral as voice.**

Physical scene: a dev in Buenos Aires, late afternoon, dim home office, laptop on a wooden desk, headphones on, 12 minutes into an interview in English. The interface is the second-quietest thing in the room. Cream paper feel, not LCD-cold whitespace.

Dark mode is **not** planned. The brand IS warm-light. A dark variant would dilute the personality. If demanded later, it requires a separate decision and a re-shoot of the scene sentence.

## Color

**Strategy: Committed.** Coral (`#FF7B5C`) carries the brand voice and ~30% of the surface across hero, CTAs, dots, accents. Ivory carries the body. Carbon carries the text. Three roles, hard-committed.

### Palette

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Brand accent | `--color-coral` | `#FF7B5C` | CTAs, dots, accent text, glow, brand mark italic "a" |
| Brand accent deep | `--color-coral-deep` | `#E55A3F` | Hover states on coral, eyebrow labels, emphasis text |
| Coral soft (tint) | `--coral-soft` | `rgba(255,123,92,0.12)` | Backgrounds for pills, icon containers |
| Carbon (text/dark) | `--color-carbon` | `#1A1A24` | Body text, headlines, dark backgrounds (Waitlist) |
| Carbon smoke | `--color-carbon-smoke` | `#2C2A3A` | Secondary dark surfaces |
| Ivory (canvas) | `--color-ivory` | `#F5EFE6` | Main background, card backgrounds |
| Ivory warm | `--color-ivory-warm` | `#F0E8D8` | Alternate sections, contrast against ivory |
| Sand | `--color-sand` | `#B8A89A` | Muted accents, secondary borders |

### Derived tokens (in `:root`)

| Token | Value | Use |
| --- | --- | --- |
| `--line` | `rgba(26, 26, 36, 0.08)` | Hairline borders, dividers |
| `--line-strong` | `rgba(26, 26, 36, 0.15)` | Card borders, prominent dividers |
| `--text-dim` | `rgba(26, 26, 36, 0.65)` | Lead paragraphs, body secondary |
| `--text-mute` | `rgba(26, 26, 36, 0.45)` | Labels, eyebrows, captions, mono URL placeholder |

### Color rules

- **Never `#000` or `#fff`.** Carbon (#1A1A24) for darkest, white only for product mockup card surface where it represents a literal browser.
- **AAA contrast verification pending.** `coral-deep` on ivory must hit ≥4.5:1 for non-body text. If it fails, drop to a deeper coral for that text role specifically.
- **No new colors without revising this file.** Three roles is the system. Adding a fourth (green for success, red for error) is reserved for product (apps/web), not brand (landing).

## Typography

### Families

| Family | Variable | Weights used | Role |
| --- | --- | --- | --- |
| **Inter** | `--font-sans` | 400, 500, 600, 700 | Body, headings, UI text |
| **Instrument Serif** | `--font-serif` | 400 (italic only) | **Accent only** — wordmark "a", 1-2 emphasis words per headline, quote emphasis |

**Rule (radical restraint).** Serif italic appears in EXACTLY 2 places: (1) the `a` of the wordmark in `BrandMark`, and (2) the "Vos brillás." line of the hero headline. Nowhere else. Section emphasis uses Inter weight 600 in `--color-coral-text` — same color cue, no italic, no serif. The product mockup's suggestion-box quote uses serif italic as a representation of the product's OWN visualization (not as a landing pattern). Anywhere else, italic-serif is forbidden.

**Flagged tension**: Instrument Serif is in impeccable's reflex-reject list (saturated in 2026). Current use is restrained enough to survive the call. If a refresh ever moves the brand toward bigger typographic risk, evaluate replacements (PP Editorial Old, Söhne Mono, Sentinel, GT Sectra, fonts from Pangram Pangram / ABC Dinamo / Klim catalogs).

### Scale (fluid)

| Step | Size | Used for |
| --- | --- | --- |
| Display | `clamp(48px, 9.5vw, 100px)` | Hero serif emphasis "Vos brillás." |
| H1 | `clamp(40px, 8vw, 84px)` | Hero headline first line |
| H2 | `clamp(32px, 5vw, 56px)` | Section titles |
| H3 | ~28-32px | Card titles, FAQ summaries |
| Body lead | `clamp(16px, 2vw, 19px)` | Hero lead, section descriptions |
| Body | 16px (1rem) | Default body text |
| Small | 13-14px | Card body, FAQ answers |
| Eyebrow | 11px uppercase tracked 0.14em | Pill labels, section eyebrows |
| Mono | "SF Mono", Menlo, monospace | URL placeholders, technical labels only |

### Letter-spacing & weight

- Headlines: `letter-spacing: -0.045em` to `-0.025em`. Tight, confident.
- Body: default tracking.
- Eyebrows/labels: `letter-spacing: 0.10em` to `0.14em`, uppercase, weight 600-700.
- Body weight: 400. Medium 500 for nav/UI labels. Semi 600 for CTAs.

### Line-height

- Body: 1.55
- Headlines: 1.0 to 1.1
- Lead paragraphs: 1.55
- Display serif: 0.85 (tight on Vos brillás.)

## Spacing & Layout

### Container

- Max content width: `1240px` for sections with imagery/cards; `920px` for headline-centric copy; `580px` for body-only paragraphs.
- Side padding: `clamp(20px, 4vw, 32px)`.

### Section rhythm

- Hero: `136px 0 100px` (clears fixed nav by 56+80)
- Standard sections: `100px` vertical padding
- Tight sections (Footer, Nav): 24-40px

Vary intentionally. Don't normalize to one spacing.

### Cards

`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` for the problem-card grid. Breakpoint-free responsiveness. Cards aren't the default affordance — only used in ProblemSection (3 problem scenarios) and the comparison table. Avoid nesting cards.

### Radii

| Token | Value | Use |
| --- | --- | --- |
| Pills / chips | `999px` | Floating chips, pill badges, CTAs |
| `--radius-md` | `0.875rem` (14px) | Inputs, small containers |
| `--radius-lg` | `1.25rem` (20px) | Cards |
| Product mockup | `18px` | The literal browser-card mockup |
| Inner mockup elements | `8-12px` | Suggestion box, context blocks |

## Elevation (shadow)

Two depths, used sparingly:

| Depth | Shadow | Use |
| --- | --- | --- |
| Hovering chip | `0 10px 30px -8px rgba(26,26,36,0.12), 0 2px 6px rgba(26,26,36,0.04)` | Floating chips around mockup |
| Hero product card | `0 30px 80px -20px rgba(26,26,36,0.22), 0 8px 24px -4px rgba(26,26,36,0.08)` | The big mockup |
| CTA glow | `0 6px 20px -6px rgba(255,123,92,0.5)` | Primary coral CTA, gives the coral a halo |

No middle elevations. Either the element floats or it sits flat against the canvas.

## Motion

### Easing tokens (in `:root`)

| Token | Curve | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | UI interactions: hover lifts, CTA press, color transitions. Default. |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | On-screen movement, modal slide |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Scroll-triggered reveals (impeccable preference) |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Hero entrance, decisive moments |
| `--ease-float` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Ambient float (chip drift) |

**Banned curves**: bounce (`cubic-bezier(0.34, 1.56, 0.64, 1)`), elastic. They feel dated and draw attention to the animation itself. Susurra's voice is silenciosa — no bounce.

### Duration tokens

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | `150ms` | Color transitions, hover states |
| `--duration-base` | `200ms` | CTA press, transforms |
| `--duration-slow` | `300ms` | Layout shifts, FAQ open/close |
| Entrance | `500-700ms` | Hero page-load choreography |
| Scroll reveal | `600-800ms` | Section entrance on scroll |

**Exit is ~75% of enter duration.** Always.

### Motion strategy (brand)

Per impeccable brand register: orchestrated page-load with staggered reveals. ONE well-rehearsed entrance > scattered micro-interactions everywhere. Susurra's page-load order:

1. Nav fades in (no slide)
2. Hero pill badge appears
3. Hero headline reveals (sans line, then serif line, ~150ms stagger)
4. Lead paragraph
5. CTAs (50ms stagger between them)
6. Product mockup scales-in + fades (the hero moment)
7. Floating chips begin their ambient float ONCE everything else settles

Scroll-triggered reveals: each section's eyebrow → heading → body → cards stagger in, ~50-80ms between elements, ease-out-quart.

### Reduced motion

Global `@media (prefers-reduced-motion: reduce)` block in `globals.css` shorts all animation/transition durations to 0.01ms. Any new motion must respect this without exceptions.

## Components

### Pill badge

11px uppercase tracked 0.14em, padding `7px 16px`, border `1px solid rgba(255,123,92,0.28)`, background `rgba(255,123,92,0.05)`, color `coral-deep`, optional leading coral dot 6×6px.

### CTA — primary

Coral background, carbon text, `999px` radius, padding `14px 26px`, font 15px weight 600, coral glow shadow. Hover: translateY(-2px). Active: scale(0.97). Custom ease-out 200ms.

### CTA — secondary

White-translucent background `rgba(255,255,255,0.6)`, line border, carbon text, same shape as primary. Hover: solid white background. Active: scale(0.97).

### Card

White or ivory background, `--line` border, `--radius-lg`. Hover: translateY(-3px). Active: scale(0.98). Custom ease-out 200ms.

### Floating chip

White background, line border, `999px` radius, padding `9px 16px`, 13px medium weight, leading coral dot 7×7px, hovering chip shadow. Drifts ambient with `anim-float-*` keyframes once page settles.

### FAQ summary

Native `<details>/<summary>`. Plus icon rotates 45° on open with ease-out 200ms. Background tints on hover. No bounce on rotation — flagged: previous pass used spring curve, must be replaced with ease-out.

### Brand mark

"susurr" (Inter 500, -0.04em tracking) + "a" (Instrument Serif italic 400, coral) + 3 coral dots (descending size and opacity) absolute top-right. Wordmark IS the brand. The dots represent the "live" listening pulse.

## Imagery

Brand register typically requires real imagery (founder photo, screenshots, etc.). Susurra currently uses:

- **Product mockup**: built in HTML/CSS as a literal "in-product moment" (interview conversation + suggestion + CV context). This counts as imagery; it's the hero image.
- **Floating chips**: typographic annotations layered on the mockup.
- **FounderSection circle**: coral gradient as placeholder for founder photo. If a real photo replaces it, must be in the warm-coral palette, taken in dim natural light, not corporate headshot.

No stock photos. No AI-generated illustrations. No icon-grid-above-each-section. If a future section wants imagery, the rule is: real, specific to Susurra's world, in the established palette.

## What's deliberately absent

- No dark mode
- No gradient text (banned)
- No glassmorphism beyond Nav's controlled backdrop-blur (12px)
- No side-stripe borders > 1px as colored accents (banned). The 3px coral left-stripe on the suggestion box inside the mockup is the EXCEPTION because it represents the product visualization, not a design pattern reusable elsewhere
- No bounce/elastic easing
- No nested cards
- No card grids of more than 3 cards
- No "trusted by" logo strips
- No testimonial carousels (if testimonials come, they go inline)
