/**
 * Susurra logo — "A" estilizada con silueta + travesaño.
 *
 * Variants:
 *  - mark: solo el símbolo "A"
 *  - wordmark: símbolo + "Susurra"
 *
 * Modes:
 *  - boxed=true (default): cuadrado negro, A en lima
 *  - boxed=false: A en lima-ink sobre fondo lima (chip)
 *
 * The mark itself is rendered inline as SVG so it scales perfectly at any
 * DPI and can be tinted via CSS custom properties (currentColor for the
 * background and explicit lime for the stroke).
 */

import type { JSX } from "react";
import { colors } from "../tokens/colors";

interface LogoProps {
  size?: number;
  variant?: "mark" | "wordmark";
  boxed?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Logo({
  size = 28,
  variant = "wordmark",
  boxed = true,
  className,
  ariaLabel = "Susurra",
}: LogoProps): JSX.Element {
  const radius = Math.round(size * 0.28);
  const bg = boxed ? colors.light.black : colors.lime;
  const fg = boxed ? colors.lime : colors.limeInk;

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={variant === "mark" ? ariaLabel : undefined}
      aria-hidden={variant === "mark" ? undefined : true}
    >
      <rect width="32" height="32" rx={radius} fill={bg} />
      {/* "A" estilizada — silueta + travesaño */}
      <path
        d="M9.5 23 L16 9 L22.5 23"
        fill="none"
        stroke={fg}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 17.4 L19.6 17.4"
        fill="none"
        stroke={fg}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === "mark") {
    return <span className={className}>{mark}</span>;
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
      aria-label={ariaLabel}
      role="img"
    >
      {mark}
      <span
        style={{
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontWeight: 800,
          fontSize: Math.round(size * 0.78),
          letterSpacing: "-0.04em",
          color: "var(--color-text)",
          lineHeight: 1,
        }}
      >
        Susurra
      </span>
    </span>
  );
}
