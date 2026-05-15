import type { CSSProperties, JSX } from "react";

interface DividerProps {
  vertical?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Divider({ vertical = false, className, style }: DividerProps): JSX.Element {
  const base: CSSProperties = vertical
    ? { width: 1, alignSelf: "stretch", background: "var(--color-border)" }
    : { height: 1, width: "100%", background: "var(--color-border)" };
  return <span aria-hidden className={className} style={{ ...base, ...style }} />;
}
