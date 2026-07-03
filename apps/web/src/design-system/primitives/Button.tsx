/**
 * Susurra Button — primary action element.
 *
 * Specs (Susurra visual system):
 *  - rounded-full (50px)
 *  - padding 13/26 (vertical/horizontal)
 *  - fontSize 14, weight 700
 *  - primary: lima sobre negro o negro sobre blanco
 *
 * Variants:
 *  - primary: lima fondo, ink lima text — main CTA
 *  - secondary: violet/lavender fondo, white text — alt CTA
 *  - ghost: transparent + border — tertiary
 *  - dark: black fondo, white/lime text — pairs against light bg
 *  - danger: red fondo, white text
 */

import clsx from "clsx";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const sizeStyle: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "8px 18px", fontSize: 13 },
  md: { padding: "13px 26px", fontSize: 14 },
  lg: { padding: "16px 32px", fontSize: 15 },
};

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--color-lime)",
    color: "var(--color-lime-ink)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "var(--color-hero-h1)",
    color: "#ffffff",
    border: "1px solid transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
  },
  dark: {
    background: "var(--color-black)",
    color: "var(--color-lime)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--color-danger)",
    color: "#ffffff",
    border: "1px solid transparent",
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    className,
    type = "button",
    style: extraStyle,
    ...rest
  },
  ref,
) {
  const style: CSSProperties = {
    ...sizeStyle[size],
    ...variantStyle[variant],
    fontFamily: "var(--font-inter)",
    fontWeight: 700,
    letterSpacing: "0",
    borderRadius: 50,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.55 : 1,
    width: fullWidth ? "100%" : undefined,
    transition: "transform 120ms ease, filter 120ms ease",
    ...extraStyle,
  };

  return (
    <button ref={ref} type={type} className={clsx("susurra-btn", className)} style={style} {...rest}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
});
