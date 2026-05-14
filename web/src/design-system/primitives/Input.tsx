/**
 * Auri Input — single-line text input with consistent shape across the app.
 */

import clsx from "clsx";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, style, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx("auri-input", className)}
      style={{
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        background: "var(--color-bg)",
        color: "var(--color-text)",
        border: `1px solid ${invalid ? "oklch(58% 0.22 25)" : "var(--color-border)"}`,
        borderRadius: 12,
        padding: "10px 14px",
        outline: "none",
        width: "100%",
        ...style,
      }}
      {...rest}
    />
  );
});
