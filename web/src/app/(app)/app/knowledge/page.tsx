"use client";

/**
 * Knowledge (/app/knowledge) — F3 full implementation.
 *
 * Composition:
 *  - DocumentUploader: 3-tab uploader (file/url/text).
 *  - Error/loading banners (Spanish copy).
 *  - DocumentList: grouped sections (global / current scenario / others).
 *  - DocumentPreviewModal, DocumentEditModal, DeleteConfirmDialog: dialogs
 *    triggered from each card.
 *
 * The page is intentionally a thin presentation shell — all data flow
 * goes through `useDocuments` (KB list) + `useScenarios` (label lookup)
 * + `useContainer().updateDocument` (edit modal). No infrastructure
 * imports here.
 */

import { useCallback, useRef, useState } from "react";
import type { JSX } from "react";
import { Pill } from "@/design-system/primitives";
import type { DocumentListItem } from "@/domain/entities/document";
import { useDocuments } from "@/presentation/hooks/use-documents";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { DocumentUploader } from "@/presentation/components/knowledge/DocumentUploader";
import { DocumentList } from "@/presentation/components/knowledge/DocumentList";
import { DocumentPreviewModal } from "@/presentation/components/knowledge/DocumentPreviewModal";
import { DocumentEditModal } from "@/presentation/components/knowledge/DocumentEditModal";
import { DeleteConfirmDialog } from "@/presentation/components/knowledge/DeleteConfirmDialog";

export default function KnowledgePage(): JSX.Element {
  const {
    documents,
    loading,
    error,
    hasFetched,
    hasCv,
    refresh,
    remove,
    setPrimary,
  } = useDocuments();
  const { available: scenarios, current: currentScenarioId } = useScenarios();

  const currentScenarioLabel =
    scenarios.find((s) => s.id === currentScenarioId)?.label ?? null;

  const uploaderRef = useRef<HTMLDivElement | null>(null);
  const scrollToUploader = useCallback(() => {
    uploaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const [previewDoc, setPreviewDoc] = useState<DocumentListItem | null>(null);
  const [editDoc, setEditDoc] = useState<DocumentListItem | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentListItem | null>(null);

  const onView = useCallback((doc: DocumentListItem) => {
    setPreviewDoc(doc);
  }, []);

  const onEdit = useCallback((doc: DocumentListItem) => {
    setPreviewDoc(null);
    setEditDoc(doc);
  }, []);

  const onDelete = useCallback((doc: DocumentListItem) => {
    setPreviewDoc(null);
    setDeleteDoc(doc);
  }, []);

  const onTogglePrimary = useCallback(
    (doc: DocumentListItem, next: boolean) => {
      // Fire-and-forget: optimistic UI inside the hook handles immediate
      // feedback, and `setError` surfaces failures (e.g. backend hasn't
      // shipped is_primary yet).
      void setPrimary(doc.id, next).catch(() => {
        // Already surfaced via `error` state.
      });
    },
    [setPrimary],
  );

  const handleConfirmDelete = useCallback(
    async (id: number) => {
      await remove(id);
    },
    [remove],
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
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill variant="lavender">F3 · Knowledge</Pill>
          {hasCv ? (
            <Pill variant="lime">CV cargado</Pill>
          ) : (
            <Pill variant="ghost">Sin CV</Pill>
          )}
          {currentScenarioLabel ? (
            <Pill variant="cyan">Escenario: {currentScenarioLabel}</Pill>
          ) : null}
        </div>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "-1.4px",
            margin: "8px 0 0",
          }}
        >
          Conocimiento
        </h1>
        <p
          style={{
            color: "var(--color-text-mid)",
            fontSize: 16,
            maxWidth: 640,
            margin: 0,
          }}
        >
          Subí tu CV, ofertas de trabajo, briefs de reunión o material de
          referencia para que Auri tenga el contexto justo durante tus
          sesiones.
        </p>
      </header>

      <div ref={uploaderRef}>
        <DocumentUploader
          currentScenarioId={currentScenarioId}
          currentScenarioLabel={currentScenarioLabel}
          onUploaded={() => void refresh()}
        />
      </div>

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

      <DocumentList
        documents={documents}
        loading={loading}
        hasFetched={hasFetched}
        currentScenarioId={currentScenarioId}
        scenarios={scenarios.map((s) => ({ id: s.id, label: s.label }))}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePrimary={onTogglePrimary}
        onScrollToUploader={scrollToUploader}
      />

      <DocumentPreviewModal
        open={previewDoc !== null}
        doc={previewDoc}
        scenarioLabel={
          previewDoc?.scenario
            ? scenarios.find((s) => s.id === previewDoc.scenario)?.label ?? null
            : null
        }
        onClose={() => setPreviewDoc(null)}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <DocumentEditModal
        open={editDoc !== null}
        doc={editDoc}
        onClose={() => setEditDoc(null)}
        onSaved={() => setEditDoc(null)}
      />

      <DeleteConfirmDialog
        open={deleteDoc !== null}
        doc={deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
