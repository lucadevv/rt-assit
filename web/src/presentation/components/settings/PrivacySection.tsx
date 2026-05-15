"use client";

/**
 * PrivacySection — auto-delete recordings after N days (FR-50).
 *
 * Tier gating: only Pro+ tiers (pro / premium / byok) can configure
 * recording retention because Free tier doesn't store recordings at all.
 * On Free we render the control disabled with a "Pro+" pill explaining
 * why.
 *
 * Persists via PATCH /api/preferences {auto_delete_recordings_days}.
 * `null` resets retention to "Nunca" (the user manages recordings
 * manually).
 */

import type { JSX } from "react";
import { Pill, Select } from "@/design-system/primitives";
import {
  AUTO_DELETE_OPTIONS,
  type UpdateUserPreferences,
  type UserPreferences,
} from "@/domain/entities/user-preferences";
import type { UserTier } from "@/domain/entities/user";
import { SettingsRow, SettingsSection } from "./SettingsSection";

interface PrivacySectionProps {
  prefs: UserPreferences;
  userTier: UserTier;
  onUpdate: (req: UpdateUserPreferences) => Promise<UserPreferences | null>;
  saving: boolean;
}

const PRO_TIERS: readonly UserTier[] = ["pro", "premium", "byok"];

function valueToString(v: number | null): string {
  return v === null ? "null" : String(v);
}

function stringToValue(s: string): number | null {
  return s === "null" ? null : Number.parseInt(s, 10);
}

export function PrivacySection({
  prefs,
  userTier,
  onUpdate,
  saving,
}: PrivacySectionProps): JSX.Element {
  const isPro = (PRO_TIERS as readonly string[]).includes(userTier);
  const currentValue = valueToString(prefs.autoDeleteRecordingsDays);

  const handlePick = async (raw: string): Promise<void> => {
    const next = stringToValue(raw);
    await onUpdate({ autoDeleteRecordingsDays: next });
  };

  return (
    <SettingsSection
      title="Privacidad"
      description="Controlá qué pasa con tus grabaciones después de un tiempo."
      trailing={
        isPro ? (
          saving ? (
            <Pill variant="ghost">Guardando…</Pill>
          ) : null
        ) : (
          <Pill variant="violet">Pro+</Pill>
        )
      }
    >
      <SettingsRow
        label="Borrar grabaciones automáticamente"
        hint={
          isPro
            ? "Susurra va a eliminar las grabaciones más viejas que el plazo elegido."
            : "Tu plan no almacena grabaciones. Mejorá a Pro para activar esta opción."
        }
        htmlFor="privacy-auto-delete"
      >
        <Select
          id="privacy-auto-delete"
          value={currentValue}
          onChange={(e) => void handlePick(e.target.value)}
          disabled={!isPro || saving}
        >
          {AUTO_DELETE_OPTIONS.map((opt) => (
            <option key={valueToString(opt.value)} value={valueToString(opt.value)}>
              {opt.label}
            </option>
          ))}
        </Select>
      </SettingsRow>
    </SettingsSection>
  );
}
