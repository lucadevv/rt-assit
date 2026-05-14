/**
 * Auri Toggle — accessible on/off switch.
 */

import clsx from "clsx";
import type { CSSProperties, JSX } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: ToggleProps): JSX.Element {
  const trackStyle: CSSProperties = {
    width: 44,
    height: 26,
    borderRadius: 9999,
    background: checked ? "var(--color-lime)" : "var(--color-border)",
    position: "relative",
    transition: "background 160ms ease",
    border: "1px solid transparent",
    flexShrink: 0,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
  const thumbStyle: CSSProperties = {
    position: "absolute",
    top: 2,
    left: checked ? 20 : 2,
    width: 20,
    height: 20,
    borderRadius: 9999,
    background: checked ? "var(--color-lime-ink)" : "var(--color-bg)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
    transition: "left 160ms ease, background 160ms ease",
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx("auri-toggle", className)}
      style={trackStyle}
    >
      <span style={thumbStyle} />
    </button>
  );
}
