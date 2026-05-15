/**
 * Susurra Card — generic content container.
 *
 * Specs:
 *  - rounded-3xl (~22px)
 *  - border 1px sólido OR no border with bg
 */

import clsx from "clsx";
import type { CSSProperties, HTMLAttributes, JSX, ReactNode } from "react";

export type CardVariant = "default" | "soft" | "warm" | "dark" | "filled";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  padded?: boolean;
  bordered?: boolean;
}

const variantStyle: Record<CardVariant, CSSProperties> = {
  default: { background: "var(--color-bg)" },
  soft: { background: "var(--color-bg-soft)" },
  warm: { background: "var(--color-bg-warm)" },
  dark: { background: "var(--color-black)", color: "var(--color-bg)" },
  filled: { background: "var(--color-lime)", color: "var(--color-lime-ink)" },
};

export function Card({
  children,
  variant = "default",
  padded = true,
  bordered = true,
  className,
  style: extraStyle,
  ...rest
}: CardProps): JSX.Element {
  const style: CSSProperties = {
    ...variantStyle[variant],
    border: bordered ? "1px solid var(--color-border)" : "1px solid transparent",
    borderRadius: 22,
    padding: padded ? 20 : 0,
    ...extraStyle,
  };
  return (
    <div className={clsx("susurra-card", className)} style={style} {...rest}>
      {children}
    </div>
  );
}
