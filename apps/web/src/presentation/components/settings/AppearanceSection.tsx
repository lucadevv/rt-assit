"use client";

/**
 * AppearanceSection — Susurra is a light-only product (Camino C decision).
 *
 * The previous light/dark/system toggle was removed when dark-mode
 * infrastructure was retired. The component is kept as a section
 * placeholder so the Settings page composition stays intact and so the
 * door is open to add other appearance options (density, font size, etc.)
 * without re-introducing the file.
 *
 * Props are preserved so the call-site in `settings/page.tsx` keeps
 * compiling; `prefs.theme` is still on the wire (backend contract) but
 * the user has no UI to change it — it stays whatever the backend
 * defaults to.
 */

import type { JSX } from "react";
import type {
  UpdateUserPreferences,
  UserPreferences,
} from "@/domain/entities/user-preferences";
import { SettingsSection } from "./SettingsSection";

interface AppearanceSectionProps {
  prefs: UserPreferences;
  onUpdate: (req: UpdateUserPreferences) => Promise<UserPreferences | null>;
  saving: boolean;
}

export function AppearanceSection(_props: AppearanceSectionProps): JSX.Element {
  return (
    <SettingsSection
      title="Apariencia"
      description="Susurra usa un único tema claro, diseñado para sentirse cálido y enfocado en lo que estás conversando."
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-mid)",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Otras opciones (densidad, tamaño de fuente) próximamente.
      </p>
    </SettingsSection>
  );
}
