"use client";

/**
 * SessionSpeakersTab — fourth tab. Lists speakers with a rename action.
 *
 * Each row shows: color dot (from `colorHint`) + current label (or
 * fallback "Hablante N") + "Renombrar" button. Clicking the button
 * inline-edits the label via the speakers REST API. After a successful
 * rename the parent's `onRefresh` re-pulls the detail so we display the
 * canonical server label.
 */

import { useState, type JSX } from "react";
import { Button, Card, Input, Pill } from "@/design-system/primitives";
import { useContainer } from "@/infrastructure/di/container";
import type { Speaker } from "@/domain/entities/speaker";
import { scenarioColorVar } from "./utils";

interface SessionSpeakersTabProps {
  sessionId: string;
  speakers: Speaker[];
  onRefresh: () => Promise<void>;
}

function defaultLabel(s: Speaker): string {
  if (s.label && s.label.trim().length > 0) return s.label;
  return `Hablante ${s.deepgramSpeakerId + 1}`;
}

interface RenameRowProps {
  sessionId: string;
  speaker: Speaker;
  onRefresh: () => Promise<void>;
}

function SpeakerRow({
  sessionId,
  speaker,
  onRefresh,
}: RenameRowProps): JSX.Element {
  const { renameSpeaker } = useContainer();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(speaker.label ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dotColor = scenarioColorVar(speaker.colorHint);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    const trimmed = value.trim();
    const label = trimmed.length === 0 ? null : trimmed;
    try {
      await renameSpeaker.execute(
        sessionId,
        speaker.deepgramSpeakerId,
        label,
      );
      await onRefresh();
      setEditing(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos renombrar al hablante.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (): void => {
    setValue(speaker.label ?? "");
    setEditing(false);
    setError(null);
  };

  return (
    <Card
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Nombre (e.g. "Ana", "Reclutador")`}
              aria-label={`Renombrar hablante ${speaker.deepgramSpeakerId + 1}`}
              autoFocus
              disabled={saving}
            />
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                {defaultLabel(speaker)}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--color-text-mid)",
                }}
              >
                {speaker.isUser ? "Vos" : "Otro participante"} · cluster{" "}
                {speaker.deepgramSpeakerId}
              </p>
            </>
          )}
        </div>

        {!editing ? (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <Pill variant="ghost">{speaker.isUser ? "Vos" : "Otro"}</Pill>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Renombrar
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
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
    </Card>
  );
}

export function SessionSpeakersTab({
  sessionId,
  speakers,
  onRefresh,
}: SessionSpeakersTabProps): JSX.Element {
  if (speakers.length === 0) {
    return (
      <Card variant="soft">
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            textAlign: "center",
            padding: "20px 8px",
          }}
        >
          No detectamos hablantes en esta sesión. Si activaste la diarización,
          esto puede tardar unos segundos después de cerrar la sesión.
        </p>
      </Card>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {speakers.map((s) => (
        <li key={s.id}>
          <SpeakerRow
            sessionId={sessionId}
            speaker={s}
            onRefresh={onRefresh}
          />
        </li>
      ))}
    </ul>
  );
}
