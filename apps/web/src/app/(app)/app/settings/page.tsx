"use client";

/**
 * Settings (/app/settings) — F6 implementation.
 *
 * Composition (top → bottom):
 *   1. Perfil           — name (editable) + email (read-only) + idioma
 *   2. Apariencia       — placeholder (light-only product, Camino C)
 *   3. Audio            — microphone device select + permission helper
 *   4. Privacidad       — auto-delete recordings (Pro+ tier only)
 *   5. Atajos           — keyboard shortcuts (read-only)
 *   6. Integraciones    — Google Calendar / Slack / Notion (Próximamente)
 *   7. Cuenta           — GDPR data delete (double confirmation)
 *
 * The page reuses F1+ hooks (useCurrentUser) and introduces F6 hooks
 * (usePreferences, useAudioDevices, etc). Composition root usage stays
 * confined to the hooks themselves — this page only orchestrates.
 */

import { type JSX } from "react";
import { useCurrentUser } from "@/presentation/hooks/use-current-user";
import { usePreferences } from "@/presentation/hooks/use-preferences";
import { Pill, Spinner } from "@/design-system/primitives";
import { ProfileSection } from "@/presentation/components/settings/ProfileSection";
import { AppearanceSection } from "@/presentation/components/settings/AppearanceSection";
import { AudioSection } from "@/presentation/components/settings/AudioSection";
import { PrivacySection } from "@/presentation/components/settings/PrivacySection";
import { ShortcutsSection } from "@/presentation/components/settings/ShortcutsSection";
import { IntegrationsSection } from "@/presentation/components/settings/IntegrationsSection";
import { SettingsSection } from "@/presentation/components/settings/SettingsSection";
import { IntegrationsList } from "@/presentation/components/settings/integrations/IntegrationsList";
import { AccountSection } from "@/presentation/components/settings/AccountSection";

export default function SettingsPage(): JSX.Element {
  const { user, loading: userLoading } = useCurrentUser();
  const {
    prefs,
    loading: prefsLoading,
    saving,
    error,
    update,
  } = usePreferences();

  if (userLoading || prefsLoading || !user || !prefs) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 24,
          color: "var(--color-text-mid)",
          fontSize: 14,
        }}
      >
        <Spinner size={18} />
        <span>Cargando configuración…</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 32,
        maxWidth: 760,
      }}
    >
      <header>
        <Pill variant="ghost">Configuración</Pill>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "-1.4px",
            margin: "12px 0 8px",
          }}
        >
          Tu <span className="italic-accent">configuración</span>
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-mid)",
            fontSize: 16,
            lineHeight: 1.5,
            maxWidth: 560,
          }}
        >
          Ajustá tu perfil, apariencia, audio, privacidad y atajos.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
            padding: 12,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}

      <ProfileSection user={user} />
      <AppearanceSection prefs={prefs} onUpdate={update} saving={saving} />
      <AudioSection prefs={prefs} onUpdate={update} saving={saving} />
      <PrivacySection
        prefs={prefs}
        userTier={user.tier}
        onUpdate={update}
        saving={saving}
      />
      <ShortcutsSection />
      <SettingsSection
        title="Reuniones"
        description="Conectá tus cuentas para que Susurra se una a tus reuniones de Meet, Zoom o Teams."
      >
        <IntegrationsList />
      </SettingsSection>
      <IntegrationsSection />
      <AccountSection user={user} />
    </div>
  );
}
