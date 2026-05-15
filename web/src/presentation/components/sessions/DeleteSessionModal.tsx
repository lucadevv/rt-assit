"use client";

/**
 * DeleteSessionModal — confirmation modal for destructive session removal.
 *
 * Keeps the UX consistent with other destructive flows in Susurra (the
 * recordings page uses a `window.confirm`, but a full modal feels more
 * appropriate for a session — there's typically more content at stake).
 *
 * Renders into a fixed overlay div. Closes on:
 *  - Escape key
 *  - clicking the backdrop
 *  - cancelling the action
 *
 * Focus management is intentionally lightweight (the design-system has no
 * Modal primitive yet). The cancel button receives autofocus so keyboard
 * users can dismiss with Enter immediately.
 */

import { useEffect, type JSX } from "react";
import { Button, Card } from "@/design-system/primitives";

interface DeleteSessionModalProps {
  open: boolean;
  title: string;
  deleting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteSessionModal({
  open,
  title,
  deleting,
  errorMessage,
  onConfirm,
  onClose,
}: DeleteSessionModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !deleting) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, deleting]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-session-title"
      onClick={() => {
        if (!deleting) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2
          id="delete-session-title"
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.4px",
            color: "var(--color-text)",
          }}
        >
          ¿Eliminar esta sesión?
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--color-text-mid)",
          }}
        >
          Vas a eliminar <strong>{title}</strong> junto con su transcript,
          sugerencias y grabación. Esta acción no se puede deshacer.
        </p>

        {errorMessage ? (
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
            {errorMessage}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="ghost"
            size="md"
            disabled={deleting}
            onClick={onClose}
            autoFocus
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="md"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Eliminando…" : "Eliminar sesión"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
