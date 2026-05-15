"use client";

/**
 * AudioSection — pick a microphone device and persist it to
 * /api/preferences {audio_device_id}.
 *
 * Browser quirk: `enumerateDevices()` returns empty labels until the
 * user has granted microphone permission at least once for the origin.
 * If labels are missing we surface a "Solicitar permisos" button that
 * triggers `getUserMedia({ audio: true })` and discards the resulting
 * stream — we only need the permission, not the audio.
 */

import { useState, type JSX } from "react";
import { Button, Pill, Select } from "@/design-system/primitives";
import { MicIcon } from "@/design-system/icons";
import { useAudioDevices } from "@/presentation/hooks/use-audio-devices";
import type {
  UpdateUserPreferences,
  UserPreferences,
} from "@/domain/entities/user-preferences";
import { SettingsRow, SettingsSection } from "./SettingsSection";

interface AudioSectionProps {
  prefs: UserPreferences;
  onUpdate: (req: UpdateUserPreferences) => Promise<UserPreferences | null>;
  saving: boolean;
}

const SYSTEM_DEFAULT = "__system_default__";

export function AudioSection({
  prefs,
  onUpdate,
  saving,
}: AudioSectionProps): JSX.Element {
  const {
    devices,
    permissionGranted,
    supported,
    requesting,
    permissionError,
    requestPermission,
  } = useAudioDevices();
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const currentValue = prefs.audioDeviceId ?? SYSTEM_DEFAULT;

  const handlePick = async (next: string): Promise<void> => {
    const audioDeviceId: string | null =
      next === SYSTEM_DEFAULT ? null : next;
    const result = await onUpdate({ audioDeviceId });
    if (result) {
      setSavedHint(
        audioDeviceId === null
          ? "Volvimos al micrófono por defecto del sistema."
          : "Dispositivo guardado.",
      );
    }
  };

  if (!supported) {
    return (
      <SettingsSection
        title="Audio"
        description="Tu navegador no expone la lista de dispositivos de audio."
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          Probá desde Chrome, Edge o Brave. Susurra necesita acceso al
          micrófono para enumerar los dispositivos.
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Audio"
      description="Elegí el micrófono que Susurra va a usar para tus sesiones."
      trailing={saving ? <Pill variant="ghost">Guardando…</Pill> : null}
    >
      {!permissionGranted ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            background: "var(--color-bg-soft)",
            borderRadius: 14,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-text)",
              lineHeight: 1.5,
            }}
          >
            Concedé acceso al micrófono para ver los dispositivos disponibles.
          </p>
          <Button
            variant="dark"
            size="sm"
            leadingIcon={<MicIcon size={14} />}
            disabled={requesting}
            onClick={() => void requestPermission()}
          >
            {requesting ? "Pidiendo permisos…" : "Solicitar permisos"}
          </Button>
        </div>
      ) : null}

      <SettingsRow
        label="Micrófono"
        hint="Si no aparece tu dispositivo, conectalo y volvé a entrar a esta página."
        htmlFor="audio-device"
      >
        <Select
          id="audio-device"
          value={currentValue}
          onChange={(e) => void handlePick(e.target.value)}
          disabled={saving}
        >
          <option value={SYSTEM_DEFAULT}>Por defecto del sistema</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </Select>
      </SettingsRow>

      {permissionError ? (
        <p
          role="alert"
          style={{
            margin: "12px 0 0",
            fontSize: 13,
            color: "var(--color-amber-ink)",
            background: "var(--color-amber)",
            padding: "8px 12px",
            borderRadius: 12,
          }}
        >
          {permissionError}
        </p>
      ) : null}

      {savedHint && !saving ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "var(--color-text-mid)",
          }}
        >
          {savedHint}
        </p>
      ) : null}
    </SettingsSection>
  );
}
