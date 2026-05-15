/**
 * Susurra Logo — official wordmark composition.
 *
 * Composition (mirrors `apps/landing/src/components/landing/BrandMark.tsx`
 * and the brand book in `design_susurra/brand_guidelines_v1.html`):
 *   "susurr" (Inter, weight 500) +
 *   "a"      (Instrument Serif, italic, coral) +
 *   "•••"    (3 coral dots, decreasing size, sitting top-right)
 *
 * The composition is inlined here instead of being imported from a shared
 * package — keeps this batch from depending on populating @susurra/ui.
 *
 * Variants:
 *   - `wordmark` (default): full composition with dots
 *   - `mark`: just the dotted "a" character — compact icon-style usage
 *
 * Sizes scale the typography proportionally. The `on-light` / `on-dark`
 * variants keep the dotted "a" coral but swap the sans color so the
 * wordmark reads cleanly on either surface (footer / dark hero overlay).
 */

import type { CSSProperties, JSX } from "react";

export type LogoSize = "sm" | "md" | "lg";
export type LogoVariantMode = "wordmark" | "mark";
export type LogoTone = "on-light" | "on-dark";

interface LogoProps {
  /**
   * Legacy `size` API — accepts either a number (px) for back-compat
   * with the previous Logo.tsx (callers in dev/design-system + Sidebar
   * pass `size={28|32|36|48}`) or a discrete token.
   */
  size?: number | LogoSize;
  variant?: LogoVariantMode;
  /** Visual tone — `on-light` (default) suits the ivory app surface. */
  tone?: LogoTone;
  /**
   * Kept for back-compat with the previous Logo API; no-op in the new
   * composition (the wordmark itself is the brand mark).
   */
  boxed?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface ResolvedScale {
  sans: number;
  serif: number;
  dot1: number;
  dot2: number;
  dot3: number;
  dotTop: number;
  paddingRight: number;
}

function resolveScale(size: number | LogoSize | undefined): ResolvedScale {
  // Map number sizes (px height of the original SVG box) to a sans font-size.
  // Heuristic: the previous SVG `size` matched the sans font-size roughly
  // 1:1 — `size={32}` rendered a ~25px wordmark. We approximate the same
  // visual weight here so existing call-sites don't shrink.
  const sansFromNumber = (n: number): number => Math.round(n * 0.85);

  if (typeof size === "number") {
    const sans = sansFromNumber(size);
    return scaleFromSans(sans);
  }

  switch (size) {
    case "sm":
      return scaleFromSans(20);
    case "lg":
      return scaleFromSans(36);
    case "md":
    default:
      return scaleFromSans(28);
  }
}

function scaleFromSans(sans: number): ResolvedScale {
  const serif = Math.round(sans * 1.45);
  const dot1 = Math.max(4, Math.round(sans * 0.18));
  const dot2 = Math.max(3, Math.round(sans * 0.14));
  const dot3 = Math.max(2, Math.round(sans * 0.11));
  const dotTop = -Math.round(sans * 0.14);
  const paddingRight = Math.round(sans * 0.65);
  return { sans, serif, dot1, dot2, dot3, dotTop, paddingRight };
}

export function Logo({
  size = "md",
  variant = "wordmark",
  tone = "on-light",
  boxed: _boxed = false,
  className,
  ariaLabel = "Susurra",
}: LogoProps): JSX.Element {
  const scale = resolveScale(size);
  const sansColor =
    tone === "on-dark" ? "var(--color-ivory)" : "var(--color-carbon)";

  const dotBase: CSSProperties = {
    display: "inline-block",
    borderRadius: "50%",
    background: "var(--color-coral)",
  };

  const sansStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    fontSize: `${scale.sans}px`,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    color: sansColor,
  };

  const serifStyle: CSSProperties = {
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
    fontWeight: 400,
    fontSize: `${scale.serif}px`,
    color: "var(--color-coral)",
    marginLeft: 1,
    lineHeight: 0.85,
  };

  const dotsWrapStyle: CSSProperties = {
    position: "absolute",
    top: `${scale.dotTop}px`,
    right: 0,
    display: "inline-flex",
    gap: 3,
    alignItems: "center",
  };

  if (variant === "mark") {
    // Compact icon-style: just the italic dotted "a".
    return (
      <span
        className={className}
        role="img"
        aria-label={ariaLabel}
        style={{
          display: "inline-flex",
          position: "relative",
          alignItems: "baseline",
          paddingRight: scale.paddingRight,
          lineHeight: 1,
        }}
      >
        <span style={serifStyle}>a</span>
        <span style={dotsWrapStyle} aria-hidden="true">
          <span
            style={{
              ...dotBase,
              width: scale.dot1,
              height: scale.dot1,
            }}
          />
          <span
            style={{
              ...dotBase,
              width: scale.dot2,
              height: scale.dot2,
              opacity: 0.6,
            }}
          />
          <span
            style={{
              ...dotBase,
              width: scale.dot3,
              height: scale.dot3,
              opacity: 0.3,
            }}
          />
        </span>
      </span>
    );
  }

  return (
    <span
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        position: "relative",
        lineHeight: 1,
        paddingRight: scale.paddingRight,
      }}
    >
      <span style={sansStyle}>susurr</span>
      <span style={serifStyle}>a</span>
      <span style={dotsWrapStyle} aria-hidden="true">
        <span
          style={{
            ...dotBase,
            width: scale.dot1,
            height: scale.dot1,
          }}
        />
        <span
          style={{
            ...dotBase,
            width: scale.dot2,
            height: scale.dot2,
            opacity: 0.6,
          }}
        />
        <span
          style={{
            ...dotBase,
            width: scale.dot3,
            height: scale.dot3,
            opacity: 0.3,
          }}
        />
      </span>
    </span>
  );
}
