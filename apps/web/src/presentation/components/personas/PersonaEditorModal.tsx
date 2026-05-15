"use client";

/**
 * PersonaEditorModal — create / edit a Persona.
 *
 * Composition (parent owns isOpen + the persona being edited):
 *   <PersonaEditorModal
 *     open
 *     persona={editingPersona ?? null}   // null = create flow
 *     onClose={() => setEditing(null)}
 *     onSaved={(p) => setEditing(null)}
 *   />
 *
 * Fields:
 *  - Name (required)
 *  - Description (textarea)
 *  - Icon picker (preset emoji grid)
 *  - Tone (radio: professional / casual / formal)
 *  - Scenario preferido (dropdown — 8 scenarios)
 *  - Custom instructions (textarea)
 *  - Documentos vinculados — radio "Identidad" / "Conocimiento" / "No incluir"
 *    per document. The link/unlink calls are fired immediately when the
 *    user toggles (so the modal doesn't need a "save links" step), but
 *    only if we have a persona id (i.e. edit flow). In create flow we
 *    defer doc-link calls until after the persona is POSTed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, JSX } from "react";
import { Button, Input, Select } from "@/design-system/primitives";
import type {
  Persona,
  PersonaTone,
} from "@/domain/entities/persona";
import {
  PERSONA_ICON_PRESETS,
  PERSONA_TONE_LABELS,
} from "@/domain/entities/persona";
import type { Scenario } from "@/domain/entities/scenario";
import type { DocumentListItem } from "@/domain/entities/document";
import { DOC_TYPE_ICONS, DOC_TYPE_LABELS } from "@/domain/entities/document";

type DocLinkChoice = "identity" | "knowledge" | "none";

interface PersonaEditorModalProps {
  open: boolean;
  persona: Persona | null;
  scenarios: Scenario[];
  documents: DocumentListItem[];
  submitting?: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    description: string | null;
    scenarioId: string | null;
    icon: string | null;
    tone: PersonaTone | null;
    customInstructions: string | null;
    docLinks: ReadonlyMap<number, DocLinkChoice>;
  }) => Promise<void>;
}

const TONE_OPTIONS: ReadonlyArray<PersonaTone> = [
  "professional",
  "casual",
  "formal",
];

export function PersonaEditorModal({
  open,
  persona,
  scenarios,
  documents,
  submitting = false,
  onClose,
  onSave,
}: PersonaEditorModalProps): JSX.Element | null {
  const isEdit = persona !== null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [tone, setTone] = useState<PersonaTone | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [docLinks, setDocLinks] = useState<Map<number, DocLinkChoice>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);

  // Seed fields when modal opens or persona changes.
  useEffect(() => {
    if (!open) return;
    if (persona) {
      setName(persona.name);
      setDescription(persona.description ?? "");
      setIcon(persona.icon);
      setTone(persona.tone);
      setScenarioId(persona.scenarioId);
      setCustomInstructions(persona.customInstructions ?? "");
    } else {
      setName("");
      setDescription("");
      setIcon(PERSONA_ICON_PRESETS[0] ?? null);
      setTone(null);
      setScenarioId(null);
      setCustomInstructions("");
    }
    setDocLinks(new Map());
    setError(null);
  }, [open, persona]);

  // Escape + body scroll lock.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return (): void => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, submitting]);

  const canSave = name.trim().length > 0 && !submitting;

  const handleSave = async (): Promise<void> => {
    if (!canSave) {
      setError("Ponele un nombre a la persona para guardarla.");
      return;
    }
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        scenarioId: scenarioId === "" ? null : scenarioId,
        icon,
        tone,
        customInstructions:
          customInstructions.trim().length > 0
            ? customInstructions.trim()
            : null,
        docLinks,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
    }
  };

  const docList = useMemo(() => documents, [documents]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 6, 22, 0.55)",
        backdropFilter: "blur(2px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Editar persona" : "Nueva persona"}
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
          borderRadius: 22,
          boxShadow: "0 24px 60px rgba(8, 6, 22, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: "none",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.4px",
              }}
            >
              {isEdit ? "Editar persona" : "Nueva persona"}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-text-mid)",
              }}
            >
              Personalizá la identidad que Susurra usa en tus sesiones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={submitting}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              width: 32,
              height: 32,
              cursor: submitting ? "not-allowed" : "pointer",
              color: "var(--color-text)",
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Field label="Nombre" hint="Cómo querés identificar a esta persona.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Luis - Desarrollador Flutter"
              maxLength={120}
              aria-label="Nombre de la persona"
            />
          </Field>

          <Field
            label="Descripción"
            hint="Una frase corta para distinguirla de las otras."
          >
            <TextArea
              value={description}
              onChange={setDescription}
              rows={2}
              placeholder="Senior dev con foco en mobile y UX."
            />
          </Field>

          <Field label="Ícono">
            <IconPicker value={icon} onChange={setIcon} />
          </Field>

          <Field label="Tono">
            <ToneRadio value={tone} onChange={setTone} />
          </Field>

          <Field
            label="Escenario preferido"
            hint="Cuando seleccionás esta persona, Susurra prioriza este escenario."
          >
            <Select
              value={scenarioId ?? ""}
              onChange={(e) =>
                setScenarioId(e.target.value === "" ? null : e.target.value)
              }
              aria-label="Escenario preferido"
            >
              <option value="">Sin preferencia</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Instrucciones personalizadas"
            hint="Estilo, vocabulario, prioridades — Susurra lo respeta en cada respuesta."
          >
            <TextArea
              value={customInstructions}
              onChange={setCustomInstructions}
              rows={5}
              placeholder="Respondé en castellano rioplatense. Usá ejemplos de código cuando aplique."
            />
          </Field>

          <Field
            label="Documentos vinculados"
            hint="Elegí cómo querés que Susurra use cada documento al usar esta persona."
          >
            <DocLinksSection
              documents={docList}
              links={docLinks}
              onChange={(docId, choice) => {
                setDocLinks((prev) => {
                  const next = new Map(prev);
                  if (choice === "none") {
                    next.delete(docId);
                  } else {
                    next.set(docId, choice);
                  }
                  return next;
                });
              }}
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

        <footer
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              void handleSave();
            }}
            disabled={!canSave}
          >
            {submitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear persona"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

// ----- Sub-components -----

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
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
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        background: "var(--color-bg)",
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

function IconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string) => void;
}): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Ícono de la persona"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
        gap: 8,
      }}
    >
      {PERSONA_ICON_PRESETS.map((emoji) => {
        const selected = emoji === value;
        const style: CSSProperties = {
          appearance: "none",
          border: `2px solid ${selected ? "var(--color-text)" : "var(--color-border)"}`,
          background: selected ? "var(--color-bg-soft)" : "var(--color-bg)",
          borderRadius: 12,
          padding: 8,
          fontSize: 22,
          lineHeight: 1,
          cursor: "pointer",
          aspectRatio: "1 / 1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        };
        return (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(emoji)}
            style={style}
          >
            <span aria-hidden>{emoji}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToneRadio({
  value,
  onChange,
}: {
  value: PersonaTone | null;
  onChange: (next: PersonaTone | null) => void;
}): JSX.Element {
  return (
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
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : opt)}
            style={{
              appearance: "none",
              border: `2px solid ${
                selected ? "var(--color-text)" : "var(--color-border)"
              }`,
              background: selected ? "var(--color-bg-soft)" : "var(--color-bg)",
              color: "var(--color-text)",
              borderRadius: 12,
              padding: "10px 12px",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {PERSONA_TONE_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}

function DocLinksSection({
  documents,
  links,
  onChange,
}: {
  documents: DocumentListItem[];
  links: ReadonlyMap<number, DocLinkChoice>;
  onChange: (docId: number, choice: DocLinkChoice) => void;
}): JSX.Element {
  if (documents.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-bg-soft)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 14,
          fontSize: 13,
          color: "var(--color-text-mid)",
          lineHeight: 1.45,
        }}
      >
        No tenés documentos todavía. Subí algunos desde{" "}
        <a
          href="/app/knowledge"
          style={{
            color: "var(--color-text)",
            textDecoration: "underline",
          }}
        >
          /app/knowledge
        </a>{" "}
        y volvé acá para vincularlos.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {documents.map((doc) => {
        const choice: DocLinkChoice = links.get(doc.id) ?? "none";
        return (
          <DocLinkRow
            key={doc.id}
            doc={doc}
            choice={choice}
            onChange={(c) => onChange(doc.id, c)}
          />
        );
      })}
    </div>
  );
}

function DocLinkRow({
  doc,
  choice,
  onChange,
}: {
  doc: DocumentListItem;
  choice: DocLinkChoice;
  onChange: (next: DocLinkChoice) => void;
}): JSX.Element {
  const options: ReadonlyArray<{ value: DocLinkChoice; label: string }> = [
    { value: "none", label: "No incluir" },
    { value: "identity", label: "Identidad" },
    { value: "knowledge", label: "Conocimiento" },
  ];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
      }}
    >
      <span style={{ fontSize: 18 }} aria-hidden>
        {DOC_TYPE_ICONS[doc.docType]}
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {doc.title}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-mid)",
          }}
        >
          {DOC_TYPE_LABELS[doc.docType]}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={`Cómo usar ${doc.title} en la persona`}
        style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
      >
        {options.map((opt) => {
          const selected = choice === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              style={{
                appearance: "none",
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.4px",
                textTransform: "uppercase",
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${
                  selected ? "var(--color-text)" : "var(--color-border)"
                }`,
                background: selected
                  ? "var(--color-bg-soft)"
                  : "var(--color-bg)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { DocLinkChoice };
