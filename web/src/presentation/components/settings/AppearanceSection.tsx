"use client";

/**
 * AppearanceSection — switch theme between light / dark / system.
 *
 * Wires both:
 *  - ThemeProvider (immediate visual feedback + localStorage persistence)
 *  - PATCH /api/preferences {theme} (cross-device persistence)
 *
 * The page-level effect that reconciles ThemeProvider with the loaded
 * preference lives in `app/(app)/app/settings/page.tsx` (one-shot, on
 * first prefs load). Here we just write through both stores when the
 * user toggles a button.
 */

import type { JSX } from "react";
import { Button, Pill } from "@/design-system/primitives";
import { MoonIcon, MonitorIcon, SunIcon } from "@/design-system/icons";
import { useTheme } from "@/design-system/theme/useTheme";
import type {
  ThemeMode,
  UserPreferences,
} from "@/domain/entities/user-preferences";
import type { UpdateUserPreferences } from "@/domain/entities/user-preferences";
import { SettingsSection } from "./SettingsSection";

interface AppearanceSectionProps {
  prefs: UserPreferences;
  onUpdate: (req: UpdateUserPreferences) => Promise<UserPreferences | null>;
  saving: boolean;
}

const OPTIONS: readonly {
  value: ThemeMode;
  label: string;
  icon: JSX.Element;
}[] = [
  { value: "light", label: "Claro", icon: <SunIcon size={16} /> },
  { value: "dark", label: "Oscuro", icon: <MoonIcon size={16} /> },
  { value: "system", label: "Sistema", icon: <MonitorIcon size={16} /> },
];

export function AppearanceSection({
  prefs,
  onUpdate,
  saving,
}: AppearanceSectionProps): JSX.Element {
  const { theme: currentTheme, setTheme } = useTheme();

  const handlePick = (next: ThemeMode): void => {
    if (next === prefs.theme && next === currentTheme) return;
    // Update ThemeProvider immediately so the user sees the change as soon
    // as they click — backend write happens in parallel.
    setTheme(next);
    void onUpdate({ theme: next });
  };

  return (
    <SettingsSection
      title="Apariencia"
      description="Elegí el tema que más te guste. «Sistema» sigue la preferencia del sistema operativo."
      trailing={saving ? <Pill variant="ghost">Guardando…</Pill> : null}
    >
      <div
        role="radiogroup"
        aria-label="Tema"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {OPTIONS.map((opt) => {
          const active = prefs.theme === opt.value;
          return (
            <Button
              key={opt.value}
              variant={active ? "primary" : "ghost"}
              size="sm"
              leadingIcon={opt.icon}
              role="radio"
              aria-checked={active}
              onClick={() => handlePick(opt.value)}
              disabled={saving}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
