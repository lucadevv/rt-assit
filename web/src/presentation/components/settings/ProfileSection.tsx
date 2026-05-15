"use client";

/**
 * ProfileSection — edit name + language; email is read-only (Clerk owns
 * email verification, so we cannot mutate it from the app).
 *
 * Saves via PATCH /api/me. The auth store is updated atomically so the
 * sidebar / topbar / dashboard greeting reflect the new name immediately.
 */

import { useEffect, useState, type JSX } from "react";
import { Button, Input, Pill, Select } from "@/design-system/primitives";
import { CheckIcon } from "@/design-system/icons";
import { useUpdateProfile } from "@/presentation/hooks/use-update-profile";
import type { User } from "@/domain/entities/user";
import { SettingsRow, SettingsSection } from "./SettingsSection";

interface ProfileSectionProps {
  user: User;
}

const LANGUAGES: readonly { value: string; label: string }[] = [
  { value: "es-419", label: "Español (Latinoamérica)" },
  { value: "es-AR", label: "Español (Argentina)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "pt-BR", label: "Português (Brasil)" },
];

export function ProfileSection({ user }: ProfileSectionProps): JSX.Element {
  const { saving, error, update } = useUpdateProfile();
  const [name, setName] = useState<string>(user.name ?? "");
  const [language, setLanguage] = useState<string>(user.languagePreferred);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Re-sync local form when the auth store hydrates a fresher user.
  useEffect(() => {
    setName(user.name ?? "");
    setLanguage(user.languagePreferred);
  }, [user.name, user.languagePreferred]);

  const dirty =
    (name.trim() || "") !== (user.name ?? "") ||
    language !== user.languagePreferred;

  const handleSave = async (): Promise<void> => {
    if (!dirty) return;
    const trimmed = name.trim();
    const result = await update({
      name: trimmed.length > 0 ? trimmed : undefined,
      languagePreferred: language,
    });
    if (result) {
      setSavedAt(Date.now());
    }
  };

  return (
    <SettingsSection
      title="Perfil"
      description="Tu nombre y el idioma con el que Susurra se comunica con vos."
      trailing={
        savedAt && !dirty && !saving ? (
          <Pill variant="lime">
            <CheckIcon size={12} /> Guardado
          </Pill>
        ) : null
      }
    >
      <SettingsRow label="Nombre" htmlFor="profile-name">
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          maxLength={200}
          disabled={saving}
        />
      </SettingsRow>
      <SettingsRow label="Email" hint="No se puede cambiar desde acá.">
        <Input
          value={user.email}
          readOnly
          aria-readonly="true"
          tabIndex={-1}
          style={{ opacity: 0.7, cursor: "not-allowed" }}
        />
      </SettingsRow>
      <SettingsRow
        label="Idioma preferido"
        hint="Susurra responde en este idioma cuando puede."
        htmlFor="profile-lang"
      >
        <Select
          id="profile-lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={saving}
        >
          {LANGUAGES.map((lng) => (
            <option key={lng.value} value={lng.value}>
              {lng.label}
            </option>
          ))}
        </Select>
      </SettingsRow>

      {error ? (
        <p
          role="alert"
          style={{
            margin: "8px 0 0",
            fontSize: 13,
            color: "var(--color-amber-ink)",
            background: "var(--color-amber)",
            padding: "8px 12px",
            borderRadius: 12,
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 16,
        }}
      >
        <Button
          variant="primary"
          size="md"
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </SettingsSection>
  );
}
