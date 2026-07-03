"use client";

/**
 * DocumentPreviewModal — opens the full content of a document for reading.
 *
 * Lazy fetches the body via `useDocumentDetail`. Header shows meta;
 * footer offers Edit + Delete shortcuts so the user can act without
 * closing first.
 */

import type { JSX } from "react";
import { Pill, Spinner, Button } from "@/design-system/primitives";
import {
  DOC_TYPE_ICONS,
  DOC_TYPE_LABELS,
  type DocumentListItem,
} from "@/domain/entities/document";
import { useDocumentDetail } from "@/presentation/hooks/use-document-detail";
import { ModalShell } from "./ModalShell";
import { formatDate, formatSize, pillVariantForDocType } from "./utils";

interface DocumentPreviewModalProps {
  open: boolean;
  doc: DocumentListItem | null;
  onClose: () => void;
  onEdit: (doc: DocumentListItem) => void;
  onDelete: (doc: DocumentListItem) => void;
  scenarioLabel?: string | null;
}

export function DocumentPreviewModal({
  open,
  doc,
  onClose,
  onEdit,
  onDelete,
  scenarioLabel,
}: DocumentPreviewModalProps): JSX.Element | null {
  const { doc: detail, loading, error } = useDocumentDetail(
    open && doc ? doc.id : null,
  );

  if (!open || !doc) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={doc.title}
      width={820}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onDelete(doc)}>
            Eliminar
          </Button>
          <Button variant="primary" size="sm" onClick={() => onEdit(doc)}>
            Editar
          </Button>
        </>
      }
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ fontSize: 22 }}>
            {DOC_TYPE_ICONS[doc.docType] ?? "📄"}
          </span>
          <Pill variant={pillVariantForDocType(doc.docType)}>
            {DOC_TYPE_LABELS[doc.docType]}
          </Pill>
          <Pill variant="ghost">
            {doc.scenario ? scenarioLabel ?? doc.scenario : "Global"}
          </Pill>
          <span style={{ fontSize: 12, color: "var(--color-text-mid)" }}>
            {formatSize(doc.sizeChars)} · {formatDate(doc.uploadedAt)}
          </span>
        </div>
        {doc.source ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-mid)",
              wordBreak: "break-all",
            }}
          >
            Fuente: {doc.source}
          </span>
        ) : null}
      </header>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spinner size={16} />
          <span style={{ color: "var(--color-text-mid)", fontSize: 14 }}>
            Cargando contenido…
          </span>
        </div>
      ) : null}
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
      {detail ? (
        <pre
          style={{
            margin: 0,
            padding: "16px 18px",
            background: "var(--color-bg-soft)",
            borderRadius: 14,
            border: "1px solid var(--color-border)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "var(--font-inter)",
            fontSize: 14,
            lineHeight: 1.55,
            maxHeight: "60vh",
            overflow: "auto",
          }}
        >
          {detail.content}
        </pre>
      ) : null}
    </ModalShell>
  );
}
