/**
 * Susurra Select — native <select> styled to match Susurra inputs.
 *
 * For F0 we use the native control to keep keyboard + a11y for free.
 * A custom Combobox can replace this in later phases when needed.
 */

import clsx from "clsx";
import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid = false, children, style, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={clsx("susurra-select", className)}
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
        appearance: "none",
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
});
