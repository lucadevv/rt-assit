/**
 * Auri Pill — small status / category chip.
 *
 * Specs (Auri visual system):
 *  - rounded-full
 *  - padding 5/13 (vertical/horizontal)
 *  - fontSize 11, weight 700-800
 *  - letter-spacing 0.6px
 *  - uppercase
 */

import clsx from "clsx";
import type { JSX, ReactNode } from "react";

export type PillVariant =
  | "lime"
  | "cyan"
  | "lavender"
  | "amber"
  | "ghost"
  | "violet"
  | "dark";

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  className?: string;
  uppercase?: boolean;
  asElement?: "span" | "button";
  onClick?: () => void;
  title?: string;
}

const variantStyle: Record<PillVariant, { bg: string; color: string; border?: string }> = {
  lime: { bg: "var(--color-lime)", color: "var(--color-lime-ink)" },
  cyan: { bg: "var(--color-cyan)", color: "var(--color-cyan-ink)" },
  lavender: { bg: "var(--color-lavender)", color: "var(--color-lavender-ink)" },
  amber: { bg: "var(--color-amber)", color: "var(--color-amber-ink)" },
  ghost: {
    bg: "transparent",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
  },
  violet: {
    bg: "var(--color-hero-h1)",
    color: "var(--color-lime)",
  },
  dark: {
    bg: "var(--color-black)",
    color: "var(--color-lime)",
  },
};

export function Pill({
  children,
  variant = "lime",
  className,
  uppercase = true,
  asElement = "span",
  onClick,
  title,
}: PillProps): JSX.Element {
  const v = variantStyle[variant];
  const style = {
    backgroundColor: v.bg,
    color: v.color,
    border: v.border ?? "1px solid transparent",
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.6px",
    textTransform: uppercase ? ("uppercase" as const) : ("none" as const),
    padding: "5px 13px",
    borderRadius: 9999,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    lineHeight: 1.05,
    cursor: asElement === "button" ? ("pointer" as const) : ("default" as const),
    userSelect: "none" as const,
  };

  if (asElement === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={clsx("auri-pill", className)}
        style={style}
      >
        {children}
      </button>
    );
  }
  return (
    <span title={title} className={clsx("auri-pill", className)} style={style}>
      {children}
    </span>
  );
}
