"use client";

/**
 * Personas (/app/personas) — H3 frontend.
 *
 * Composition:
 *  - Header: title + "Nueva persona" CTA.
 *  - Grid of `PersonaCard` (3 col desktop, auto-fill).
 *  - `PersonaEditorModal` for create / edit flow.
 *  - Confirm-dialog inline for delete.
 *
 * Data flow goes through `usePersonas` (CRUD + optimistic store updates)
 * and `useDocuments` (for the editor's document link section).
 *
 * NOTE: H1 backend may not yet expose `/api/personas`. In that case the
 * hook surfaces the error in `error` and renders an empty list — the
 * page does NOT crash. Once H1 ships, refresh() will pick up the live
 * data automatically.
 */

import { useCallback, useState } from "react";
import type { JSX } from "react";
import { Button, Pill } from "@/design-system/primitives";
import { PlusIcon } from "@/design-system/icons";
import { usePersonas } from "@/presentation/hooks/use-personas";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { useDocuments } from "@/presentation/hooks/use-documents";
import type { Persona } from "@/domain/entities/persona";
import { scenarioColorOf } from "@/domain/entities/scenario";
import { PersonaCard } from "@/presentation/components/personas/PersonaCard";
import {
  PersonaEditorModal,
  type DocLinkChoice,
} from "@/presentation/components/personas/PersonaEditorModal";

export default function PersonasPage(): JSX.Element {
  const {
    personas,
    loading,
    error,
    hasFetched,
    create,
    update,
    remove,
    setDefault,
    linkDocument,
    unlinkDocument,
  } = usePersonas();
  const { available: scenarios } = useScenarios();
  const { documents } = useDocuments();

  const [editing, setEditing] = useState<Persona | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Persona | null>(null);

  const openCreate = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((p: Persona) => {
    setEditing(p);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (submitting) return;
    setEditorOpen(false);
    setEditing(null);
  }, [submitting]);

  const handleSave = useCallback(
    async (input: {
      name: string;
      description: string | null;
      scenarioId: string | null;
      icon: string | null;
      tone: Persona["tone"];
      customInstructions: string | null;
      docLinks: ReadonlyMap<number, DocLinkChoice>;
    }): Promise<void> => {
      setSubmitting(true);
      try {
        const saved: Persona = editing
          ? await update(editing.id, {
              name: input.name,
              description: input.description,
              scenarioId: input.scenarioId,
              icon: input.icon,
              tone: input.tone,
              customInstructions: input.customInstructions,
            })
          : await create({
              name: input.name,
              description: input.description,
              scenarioId: input.scenarioId,
              icon: input.icon,
              tone: input.tone,
              customInstructions: input.customInstructions,
            });

        // Doc-links: fire-and-await against the saved persona id.
        // Failures here surface as errors but don't roll back the persona
        // save — the user can retry the linking from the editor.
        const linkOps: Promise<unknown>[] = [];
        for (const [docId, choice] of input.docLinks.entries()) {
          if (choice === "identity") {
            linkOps.push(linkDocument(saved.id, docId, true));
          } else if (choice === "knowledge") {
            linkOps.push(linkDocument(saved.id, docId, false));
          } else {
            linkOps.push(unlinkDocument(saved.id, docId).catch(() => undefined));
          }
        }
        if (linkOps.length > 0) {
          await Promise.allSettled(linkOps);
        }

        setEditorOpen(false);
        setEditing(null);
      } finally {
        setSubmitting(false);
      }
    },
    [editing, create, update, linkDocument, unlinkDocument],
  );

  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      // Error already surfaced via the hook's `error` state.
    }
  }, [pendingDelete, remove]);

  const handleSetDefault = useCallback(
    (p: Persona) => {
      void setDefault(p.id).catch(() => {
        // Surfaced via store error.
      });
    },
    [setDefault],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1100,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill variant="lavender">H3 · Personas</Pill>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1
              style={{
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-1.4px",
                margin: 0,
              }}
            >
              Tus <span className="italic-accent">personas</span>
            </h1>
            <p
              style={{
                color: "var(--color-text-mid)",
                fontSize: 16,
                maxWidth: 640,
                margin: 0,
              }}
            >
              Tus identidades para distintos escenarios. Susurra usa la persona
              que elijas para ajustar tono, lenguaje y prioridades en cada
              sesión.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leadingIcon={<PlusIcon size={16} />}
            onClick={openCreate}
          >
            Nueva persona
          </Button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.4)",
            borderRadius: 14,
            padding: "12px 16px",
            color: "var(--color-text)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {!hasFetched || loading ? (
        <div
          style={{
            color: "var(--color-text-mid)",
            fontSize: 14,
            padding: 16,
          }}
        >
          Cargando personas…
        </div>
      ) : personas.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {personas.map((p) => {
            const scenario = p.scenarioId
              ? scenarios.find((s) => s.id === p.scenarioId)
              : null;
            return (
              <PersonaCard
                key={p.id}
                persona={p}
                scenarioLabel={scenario?.label ?? null}
                scenarioColor={scenario ? scenarioColorOf(scenario) : null}
                onEdit={openEdit}
                onDelete={(persona) => setPendingDelete(persona)}
                onSetDefault={handleSetDefault}
              />
            );
          })}
        </div>
      )}

      <PersonaEditorModal
        open={editorOpen}
        persona={editing}
        scenarios={scenarios}
        documents={documents}
        submitting={submitting}
        onClose={closeEditor}
        onSave={handleSave}
      />

      {pendingDelete ? (
        <DeletePersonaDialog
          persona={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }): JSX.Element {
  return (
    <div
      style={{
        border: "1px dashed var(--color-border)",
        borderRadius: 18,
        padding: 32,
        background: "var(--color-bg-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span aria-hidden style={{ fontSize: 36 }}>
        {"\u{1F464}"}
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.4px",
        }}
      >
        Aún no tenés personas
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--color-text-mid)",
          maxWidth: 520,
          lineHeight: 1.5,
        }}
      >
        Creá una para personalizar tu identidad por escenario. Pensala como
        un preset: nombre, tono, escenario preferido y documentos vinculados.
      </p>
      <Button
        variant="primary"
        size="md"
        leadingIcon={<PlusIcon size={16} />}
        onClick={onCreate}
      >
        Crear mi primera persona
      </Button>
    </div>
  );
}

function DeletePersonaDialog({
  persona,
  onCancel,
  onConfirm,
}: {
  persona: Persona;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 6, 22, 0.55)",
        backdropFilter: "blur(2px)",
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5vh 16px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar eliminación"
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--color-bg)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
          borderRadius: 18,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 24px 60px rgba(8, 6, 22, 0.35)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.3px",
          }}
        >
          Eliminar persona
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          ¿Seguro que querés borrar <strong>{persona.name}</strong>? Esta
          acción no se puede deshacer.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
