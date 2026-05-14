/**
 * Auri inline SVG icon set. Pure presentational components.
 *
 * Why inline SVG:
 *  - No icon-library dependency (saves bundle size + tree-shaking issues)
 *  - Trivial to recolor via currentColor + size via prop
 *  - Crisp at any DPI without sprite gymnastics
 *
 * All icons accept the same prop shape, exported as IconProps below.
 */

import type { JSX, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

const baseProps = (size: number, rest: Omit<IconProps, "size">) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...rest,
});

export function MicIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function CamIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M3 7h11l3-2v14l-3-2H3z" />
      <circle cx="9" cy="12" r="2.5" />
    </svg>
  );
}

export function SparkleIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
      <path d="M19 15l.8 2 2 .8-2 .8L19 21l-.8-2.4-2-.8 2-.8z" />
    </svg>
  );
}

export function PlusIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

export function CheckIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M5 12.5l5 5 9-11" />
    </svg>
  );
}

export function XIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function SunIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M21 12.5A9 9 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5z" />
    </svg>
  );
}

export function DocIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h6" />
    </svg>
  );
}

export function HomeIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function LiveIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M5.5 5.5a9 9 0 0 0 0 13" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      <path d="M2 2.5a13 13 0 0 0 0 19" />
      <path d="M22 2.5a13 13 0 0 1 0 19" />
    </svg>
  );
}

export function BookIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M4 5a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2z" />
      <path d="M4 18a2 2 0 0 0 2 2h12" />
      <path d="M8 7h7M8 11h7" />
    </svg>
  );
}

export function FilmIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
    </svg>
  );
}

export function SettingsIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function CardIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </svg>
  );
}

export function ShareIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5l6.8-4" />
      <path d="M8.6 13.5l6.8 4" />
    </svg>
  );
}

export function MonitorIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

export function UserIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function LogOutIcon({ size = 20, ...rest }: IconProps): JSX.Element {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
