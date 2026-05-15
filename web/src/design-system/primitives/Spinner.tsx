/**
 * Susurra Spinner — small loading indicator.
 *
 * Uses CSS keyframes injected once per page from globals.css (.susurra-spin).
 * Keeps DOM minimal and respects prefers-reduced-motion via globals.css.
 */

import clsx from "clsx";
import type { CSSProperties, JSX } from "react";

interface SpinnerProps {
  size?: number;
  color?: string;
  thickness?: number;
  className?: string;
}

export function Spinner({
  size = 18,
  color = "var(--color-text-mid)",
  thickness = 2,
  className,
}: SpinnerProps): JSX.Element {
  const style: CSSProperties = {
    width: size,
    height: size,
    border: `${thickness}px solid var(--color-border)`,
    borderTopColor: color,
    borderRadius: 9999,
    display: "inline-block",
  };
  return (
    <span
      className={clsx("susurra-spin", className)}
      role="status"
      aria-label="Cargando"
      style={style}
    />
  );
}
