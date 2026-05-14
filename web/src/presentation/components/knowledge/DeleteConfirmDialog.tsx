"use client";

/**
 * DeleteConfirmDialog — small modal-shell that asks for confirmation
 * before a destructive delete (FR-35). Spanish UX strings throughout.
 */

import { useState } from "react";
import type { JSX } from "react";
import { Button } from "@/design-system/primitives";
import type { DocumentListItem } from "@/domain/entities/document";
import { ModalShell } from "./ModalShell";

interface DeleteConfirmDialogProps {
  open: boolean;
  doc: DocumentListItem | null;
  onClose: () => void;
  onConfirm: (id: number) => Promise<void>;
}

export function DeleteConfirmDialog({
  open,
  doc,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps): JSX.Element | null {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !doc) return null;

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(doc.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(`No se pudo eliminar: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Eliminar documento"
      width={520}
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? "Eliminando…" : "Sí, eliminar"}
          </Button>
        </>
      }
    >
      <p style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.5 }}>
        ¿Seguro que querés eliminar{" "}
        <strong>«{doc.title}»</strong>? No vas a poder recuperarlo.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--color-text-mid)",
        }}
      >
        Si lo necesitás más adelante vas a tener que volver a subirlo.
      </p>
      {error ? (
        <div
          role="alert"
          style={{
            marginTop: 12,
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
    </ModalShell>
  );
}
