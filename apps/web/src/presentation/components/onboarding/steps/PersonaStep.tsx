"use client";

/**
 * PersonaStep — Step 4/5. Create the user's first persona.
 *
 * Approach:
 *  - Auto-suggest a default persona based on whether a CV was uploaded
 *    in step 2. If yes → name "Mi perfil dev", description references the
 *    CV. If skipped → name "Mi perfil principal" with no doc linkage.
 *  - User can edit name, description, tone, and custom instructions
 *    inline (lightweight version of PersonaEditorModal — fewer fields so
 *    the wizard stays fast).
 *  - On "Crear persona" → POST /api/personas + (if cvDocumentId set)
 *    link the doc as identity. Both calls happen serially because the
 *    link endpoint needs the new persona id.
 *  - The new persona is marked `isDefault=true` implicitly via
 *    `setDefault(id)` after creation so the rest of the app picks it up
 *    automatically.
 */

import { useEffect, useMemo, useState, type JSX } from "react";
import { Card, Input, Pill } from "@/design-system/primitives";
import { usePersonas } from "@/presentation/hooks/use-personas";
import {
  PERSONA_TONE_LABELS,
  type PersonaTone,
} from "@/domain/entities/persona";
import { WizardNav } from "../WizardNav";

interface PersonaStepProps {
  cvDocumentId: number | null;
  scenarioId: string | null;
  initialPersonaId: number | null;
  onNext: (personaId: number | null) => void;
  onBack: () => void;
}

const TONE_OPTIONS: ReadonlyArray<PersonaTone> = [
  "professional",
  "casual",
  "formal",
];

export function PersonaStep({
  cvDocumentId,
  scenarioId,
  initialPersonaId,
  onNext,
  onBack,
}: PersonaStepProps): JSX.Element {
  const { create, setDefault, linkDocument } = usePersonas();

  // Defaults adapt to whether the CV was uploaded — the wizard explicitly
  // hands `cvDocumentId=null` when the user skipped step 2.
  const suggestedDefaults = useMemo(() => {
    if (cvDocumentId !== null) {
      return {
        name: "Mi perfil dev",
        description: "Generado desde tu CV — editalo cuando quieras.",
      };
    }
    return {
      name: "Mi perfil principal",
      description: "Tu primera persona — sumá detalles cuando puedas.",
    };
  }, [cvDocumentId]);

  const [name, setName] = useState(suggestedDefaults.name);
  const [description, setDescription] = useState(suggestedDefaults.description);
  const [tone, setTone] = useState<PersonaTone>("professional");
  const [customInstructions, setCustomInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed suggestion when cvDocumentId changes (e.g. user went back to
  // step 2, uploaded, returned). Don't overwrite mid-edit — only re-seed
  // when the values still match the previous suggestion (best-effort UX).
  useEffect(() => {
    setName((prev) =>
      prev === "Mi perfil dev" || prev === "Mi perfil principal"
        ? suggestedDefaults.name
        : prev,
    );
    setDescription((prev) =>
      prev === "" ||
      prev === "Generado desde tu CV — editalo cuando quieras." ||
      prev === "Tu primera persona — sumá detalles cuando puedas."
        ? suggestedDefaults.description
        : prev,
    );
  }, [suggestedDefaults]);

  const canSave = name.trim().length > 0 && !submitting;

  const handleNext = async (): Promise<void> => {
    // Idempotency: if the user already created a persona in this wizard
    // session (Back from step 5) we don't recreate one — just pass the
    // existing id up.
    if (initialPersonaId !== null) {
      onNext(initialPersonaId);
      return;
    }
    if (!canSave) {
      setError("Ponele un nombre a la persona para continuar.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await create({
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        scenarioId: scenarioId ?? null,
        icon: "user",
        tone,
        customInstructions:
          customInstructions.trim().length > 0
            ? customInstructions.trim()
            : null,
      });
      // Best-effort: link CV as identity doc. Failure here does NOT block
      // the wizard — the persona exists and the user can link the doc
      // manually from /app/personas later.
      if (cvDocumentId !== null) {
        try {
          await linkDocument(created.id, cvDocumentId, true);
        } catch (linkErr) {
          // eslint-disable-next-line no-console -- dev signal only
          console.warn(
            "[susurra] failed to link CV to persona — user can link manually",
            linkErr,
          );
        }
      }
      // Best-effort: mark as default. Same fail-open approach.
      try {
        await setDefault(created.id);
      } catch (defaultErr) {
        // eslint-disable-next-line no-console -- dev signal only
        console.warn(
          "[susurra] failed to mark persona as default — non-fatal",
          defaultErr,
        );
      }
      onNext(created.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(`No pudimos crear la persona: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        padded
        variant="soft"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <Pill variant="lime">Paso 4</Pill>
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.6px",
          }}
        >
          Creá tu primera persona
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            lineHeight: 1.55,
          }}
        >
          Una persona es la voz con la que Susurra habla por vos. Te
          dejamos un punto de partida — ajustalo si querés.
          {cvDocumentId !== null
            ? " Tu CV queda vinculado como identidad de esta persona."
            : ""}
        </p>
      </Card>

      <Card padded>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nombre">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi perfil dev"
              maxLength={120}
              aria-label="Nombre de la persona"
            />
          </Field>

          <Field label="Descripción">
            <TextArea
              value={description}
              onChange={setDescription}
              rows={2}
              placeholder="Senior dev con foco en mobile y UX."
            />
          </Field>

          <Field label="Tono">
            <div
              role="radiogroup"
              aria-label="Tono de la persona"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {TONE_OPTIONS.map((opt) => {
                const selected = tone === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTone(opt)}
                    style={{
                      appearance: "none",
                      cursor: "pointer",
                      border: `2px solid ${
                        selected
                          ? "var(--color-text)"
                          : "var(--color-border)"
                      }`,
                      background: selected
                        ? "var(--color-bg-soft)"
                        : "var(--color-bg)",
                      color: "var(--color-text)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontFamily: "var(--font-inter)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {PERSONA_TONE_LABELS[opt]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label="Instrucciones (opcional)"
            hint="Estilo, vocabulario, prioridades — Susurra los respeta en cada respuesta."
          >
            <TextArea
              value={customInstructions}
              onChange={setCustomInstructions}
              rows={3}
              placeholder="Respondé en castellano rioplatense. Usá ejemplos de código cuando aplique."
            />
          </Field>

          {error ? (
            <div
              role="alert"
              style={{
                background: "rgba(220, 38, 38, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.4)",
                borderRadius: 12,
                padding: "10px 14px",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      </Card>

      <WizardNav
        onBack={onBack}
        onNext={() => {
          void handleNext();
        }}
        nextDisabled={!canSave}
        nextLoading={submitting}
        nextLabel={initialPersonaId !== null ? "Continuar" : "Crear persona"}
      />
    </div>
  );
}

// ---------- helpers ----------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "var(--color-text-mid)",
        }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-mid)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  rows: number;
  placeholder?: string;
}): JSX.Element {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      style={{
        fontFamily: "var(--font-inter)",
        fontSize: 14,
        fontWeight: 500,
        background: "var(--color-bg-soft)",
        color: "var(--color-text)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "10px 14px",
        outline: "none",
        width: "100%",
        resize: "vertical",
        minHeight: 60,
      }}
    />
  );
}
