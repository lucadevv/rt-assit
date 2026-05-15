"use client";

/**
 * DocumentEditModal — edit title and/or content (FR-37).
 *
 * NOTE: backend does not yet expose `PATCH /api/documents/{id}`. The modal
 * still renders fully so the UX shape is correct; on Save it tries the
 * PATCH and surfaces the 405/404 with a "Próximamente" hint so the user
 * understands the feature is wired client-side and waiting for backend.
 *
 * When backend ships PATCH, no client change is needed — the existing
 * adapter + use case route already target the right URL.
 */

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Button, Input, Pill, Spinner } from "@/design-system/primitives";
import {
  DOC_TYPE_LABELS,
  type DocumentListItem,
} from "@/domain/entities/document";
import { useContainer } from "@/infrastructure/di/container";
import { useDocumentDetail } from "@/presentation/hooks/use-document-detail";
import { useDocumentsStore } from "@/application/stores/documents.store";
import { ModalShell } from "./ModalShell";
import { pillVariantForDocType } from "./utils";

interface DocumentEditModalProps {
  open: boolean;
  doc: DocumentListItem | null;
  onClose: () => void;
  onSaved: (next: DocumentListItem) => void;
}

export function DocumentEditModal({
  open,
  doc,
  onClose,
  onSaved,
}: DocumentEditModalProps): JSX.Element | null {
  const { updateDocument } = useContainer();
  const upsertDocument = useDocumentsStore((s) => s.upsertDocument);
  const { doc: detail, loading: loadingDetail } = useDocumentDetail(
    open && doc ? doc.id : null,
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open && detail) {
      setTitle(detail.title);
      setContent(detail.content);
      setSaveError(null);
    }
  }, [open, detail]);

  if (!open || !doc) return null;

  const dirty =
    detail !== null && (title !== detail.title || content !== detail.content);

  const onSave = async (): Promise<void> => {
    if (!detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await updateDocument.execute(doc.id, {
        title: title !== detail.title ? title : undefined,
        content: content !== detail.content ? content : undefined,
      });
      const listItem: DocumentListItem = {
        id: next.id,
        docType: next.docType,
        scenario: next.scenario,
        title: next.title,
        source: next.source,
        uploadedAt: next.uploadedAt,
        sizeChars: next.sizeChars,
        metadata: next.metadata,
      };
      upsertDocument(listItem);
      onSaved(listItem);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      const looksLikeNotImplemented =
        /\b(404|405|Not Found|Method Not Allowed)\b/i.test(msg);
      setSaveError(
        looksLikeNotImplemented
          ? "La edición todavía no está disponible en el backend (próximamente). Tu cambio no se guardó."
          : `No se pudo guardar: ${msg}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Editar documento"
      width={820}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || saving || loadingDetail}
            onClick={() => void onSave()}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Pill variant={pillVariantForDocType(doc.docType)}>
            {DOC_TYPE_LABELS[doc.docType]}
          </Pill>
          <Pill variant="ghost">
            {doc.scenario ? doc.scenario : "Global"}
          </Pill>
        </div>

        {loadingDetail ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Spinner size={16} />
            <span style={{ color: "var(--color-text-mid)", fontSize: 14 }}>
              Cargando contenido…
            </span>
          </div>
        ) : null}

        {!loadingDetail && detail ? (
          <>
            <div>
              <label
                htmlFor="kb-edit-title"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  color: "var(--color-text-mid)",
                  marginBottom: 6,
                  fontFamily:
                    "var(--font-jet-brains-mono), ui-monospace, monospace",
                }}
              >
                Título
              </label>
              <Input
                id="kb-edit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="kb-edit-content"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  color: "var(--color-text-mid)",
                  marginBottom: 6,
                  fontFamily:
                    "var(--font-jet-brains-mono), ui-monospace, monospace",
                }}
              >
                Contenido
              </label>
              <textarea
                id="kb-edit-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                style={{
                  width: "100%",
                  fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg)",
                  color: "var(--color-text)",
                  outline: "none",
                  resize: "vertical",
                  minHeight: 240,
                }}
              />
            </div>
          </>
        ) : null}

        {saveError ? (
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
            {saveError}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
