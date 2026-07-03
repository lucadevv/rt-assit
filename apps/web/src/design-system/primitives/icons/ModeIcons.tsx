import type { CSSProperties } from "react";

type IconProps = {
  size?: number;
  color?: string;
  style?: CSSProperties;
};

/** Audio-wave glyph: 3 vertical bars of variable height. Represents Susurra "agente" mode (real-time suggestion). */
export function AgentIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="2" y="5" width="1.5" height="4" rx="0.75" fill={color} />
      <rect x="5" y="2" width="1.5" height="10" rx="0.75" fill={color} />
      <rect x="8" y="4" width="1.5" height="6" rx="0.75" fill={color} />
      <rect x="11" y="6" width="1.5" height="2" rx="0.75" fill={color} />
    </svg>
  );
}

/** Document-text glyph: rectangle with 3 horizontal lines inside. Represents Susurra "scribe" mode (post-hoc notes). */
export function ScribeIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="2.5" y="1.5" width="9" height="11" rx="1.2" stroke={color} strokeWidth="1.2" fill="none" />
      <line x1="4.5" y1="5" x2="9.5" y2="5" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="4.5" y1="7" x2="9.5" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="4.5" y1="9" x2="7.5" y2="9" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
