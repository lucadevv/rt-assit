/**
 * Susurra Input — single-line text input with consistent shape across the app.
 *
 * Supports an inline error/hint slot below the field. Pass `invalid` +
 * `errorMessage` for validation failures; pass `hint` for non-error helper
 * copy. Both wire up `aria-invalid` and `aria-describedby` so screen
 * readers announce the message correctly.
 */

import clsx from "clsx";
import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  errorMessage?: string | null;
  hint?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    invalid = false,
    errorMessage = null,
    hint = null,
    style,
    id: idProp,
    "aria-describedby": describedByProp,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const hasError = invalid && !!errorMessage;
  const hasHint = !hasError && !!hint;
  const errorId = hasError ? `${id}-error` : null;
  const hintId = hasHint ? `${id}-hint` : null;
  const describedBy = [describedByProp, errorId, hintId]
    .filter(Boolean)
    .join(" ") || undefined;

  if (!hasError && !hasHint) {
    return (
      <input
        ref={ref}
        id={id}
        className={clsx("susurra-input", className)}
        style={{
          fontFamily: "var(--font-inter)",
          fontSize: 14,
          fontWeight: 500,
          background: "var(--color-bg)",
          color: "var(--color-text)",
          border: `1px solid ${invalid ? "var(--color-danger)" : "var(--color-border)"}`,
          borderRadius: 12,
          padding: "10px 14px",
          outline: "none",
          width: "100%",
          ...style,
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <input
        ref={ref}
        id={id}
        className={clsx("susurra-input", className)}
        style={{
          fontFamily: "var(--font-inter)",
          fontSize: 14,
          fontWeight: 500,
          background: "var(--color-bg)",
          color: "var(--color-text)",
          border: `1px solid ${invalid ? "var(--color-danger)" : "var(--color-border)"}`,
          borderRadius: 12,
          padding: "10px 14px",
          outline: "none",
          width: "100%",
          ...style,
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hasError ? (
        <span
          id={errorId ?? undefined}
          role="alert"
          style={{
            fontSize: 12,
            color: "var(--color-danger)",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 4,
            lineHeight: 1.45,
          }}
        >
          {errorMessage}
        </span>
      ) : null}
      {hasHint ? (
        <span
          id={hintId ?? undefined}
          style={{
            fontSize: 12,
            color: "var(--color-text-mid)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
});
