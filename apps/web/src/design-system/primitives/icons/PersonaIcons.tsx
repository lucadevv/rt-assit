import type { CSSProperties, ComponentType } from "react";

type IconProps = {
  size?: number;
  color?: string;
  style?: CSSProperties;
};

const baseStyle: CSSProperties = {
  display: "inline-block",
  verticalAlign: "middle",
  flexShrink: 0,
};

/** Generic person — circle (head) + arc (shoulders). */
export function PersonaUser({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <circle cx="7" cy="5" r="2.2" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M 2.5 12 Q 7 8.5 11.5 12" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Developer — angle brackets `< >`. */
export function PersonaDev({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <path d="M 5 3.5 L 2 7 L 5 10.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M 9 3.5 L 12 7 L 9 10.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Interview — speech bubble outline. */
export function PersonaInterview({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <path d="M 2 4 Q 2 2.5 3.5 2.5 L 10.5 2.5 Q 12 2.5 12 4 L 12 8 Q 12 9.5 10.5 9.5 L 6 9.5 L 4 11.5 L 4 9.5 Q 2 9.5 2 8 Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Interviewer — clipboard outline. */
export function PersonaInterviewer({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <rect x="3" y="2.5" width="8" height="10" rx="1.2" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="5.25" y="1.5" width="3.5" height="2" rx="0.6" stroke={color} strokeWidth="1.2" fill="none" />
      <line x1="5" y1="7" x2="9" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="5" y1="9.25" x2="8" y2="9.25" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** Candidate — person silhouette + arrow up (career ascent). */
export function PersonaCandidate({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <circle cx="5" cy="4.5" r="1.8" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M 2 11.5 Q 2 8.5 5 8.5 Q 7 8.5 7.5 9.75" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M 10.5 11 L 10.5 5.5 M 8.5 7.5 L 10.5 5.5 L 12.5 7.5" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Manager — two stacked rectangles (team hierarchy). */
export function PersonaManager({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <rect x="4.5" y="2" width="5" height="3.5" rx="0.8" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="1.5" y="8.5" width="4" height="3.5" rx="0.8" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="8.5" y="8.5" width="4" height="3.5" rx="0.8" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M 7 5.5 L 7 7 M 3.5 7 L 10.5 7 M 3.5 7 L 3.5 8.5 M 10.5 7 L 10.5 8.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** Sales — two squares meeting (handshake stylization). */
export function PersonaSales({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <rect x="1.5" y="4.5" width="4" height="5" rx="0.8" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="8.5" y="4.5" width="4" height="5" rx="0.8" stroke={color} strokeWidth="1.2" fill="none" />
      <line x1="5.5" y1="7" x2="8.5" y2="7" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Client — building outline with 3 windows. */
export function PersonaClient({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <rect x="2.5" y="2" width="9" height="10" rx="0.8" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="4" y="4" width="1.5" height="1.5" fill={color} />
      <rect x="8.5" y="4" width="1.5" height="1.5" fill={color} />
      <rect x="4" y="7" width="1.5" height="1.5" fill={color} />
      <rect x="8.5" y="7" width="1.5" height="1.5" fill={color} />
      <rect x="6" y="9.5" width="2" height="2.5" fill={color} />
    </svg>
  );
}

/** Technical — 8-tooth gear. */
export function PersonaTechnical({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <circle cx="7" cy="7" r="2.2" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M 7 1.5 L 7 3.2 M 7 10.8 L 7 12.5 M 1.5 7 L 3.2 7 M 10.8 7 L 12.5 7 M 3.1 3.1 L 4.3 4.3 M 9.7 9.7 L 10.9 10.9 M 10.9 3.1 L 9.7 4.3 M 4.3 9.7 L 3.1 10.9" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Creative — diagonal paintbrush. */
export function PersonaCreative({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <path d="M 11.5 2.5 L 6.5 7.5 L 5 9 L 4 8 L 5.5 6.5 L 10.5 1.5 Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <path d="M 4 8 Q 2.5 9.5 2 12 Q 4.5 11.5 6 10 Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Educator — open book (2 pages). */
export function PersonaEducator({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <path d="M 2 3.5 Q 4.5 3 7 4 Q 9.5 3 12 3.5 L 12 11 Q 9.5 10.5 7 11.5 Q 4.5 10.5 2 11 Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <line x1="7" y1="4" x2="7" y2="11.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Custom — dotted circle (placeholder slot). */
export function PersonaCustom({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...baseStyle, ...style }} aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth="1.2" strokeDasharray="1.6 1.6" fill="none" />
      <circle cx="7" cy="7" r="1" fill={color} />
    </svg>
  );
}

export const PERSONA_ICONS = {
  user: PersonaUser,
  dev: PersonaDev,
  interview: PersonaInterview,
  interviewer: PersonaInterviewer,
  candidate: PersonaCandidate,
  manager: PersonaManager,
  sales: PersonaSales,
  client: PersonaClient,
  technical: PersonaTechnical,
  creative: PersonaCreative,
  educator: PersonaEducator,
  custom: PersonaCustom,
} as const satisfies Record<string, ComponentType<IconProps>>;

export type PersonaIconKey = keyof typeof PERSONA_ICONS;

export const PERSONA_ICON_LABELS: Record<PersonaIconKey, string> = {
  user: "Persona",
  dev: "Desarrollo",
  interview: "Entrevista",
  interviewer: "Entrevistador",
  candidate: "Candidato",
  manager: "Manager",
  sales: "Sales",
  client: "Cliente",
  technical: "Técnico",
  creative: "Creativo",
  educator: "Educador",
  custom: "Personalizado",
};

export const PERSONA_ICON_KEYS: readonly PersonaIconKey[] = [
  "user",
  "dev",
  "interview",
  "interviewer",
  "candidate",
  "manager",
  "sales",
  "client",
  "technical",
  "creative",
  "educator",
  "custom",
];

export function isPersonaIconKey(value: string): value is PersonaIconKey {
  return value in PERSONA_ICONS;
}
