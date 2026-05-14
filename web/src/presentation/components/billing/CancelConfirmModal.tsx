"use client";

/**
 * CancelConfirmModal — confirmation UX for "Cancelar suscripción".
 *
 * Behaviour mirrors DeleteAccountModal (F6):
 *  - Full-screen overlay with backdrop (ESC / click outside cancels).
 *  - alertdialog role + focus trap + body scroll lock.
 *  - Optional reason textarea (non-mandatory — captured for analytics
 *    if the backend gains a reason column later).
 *  - Reassures: access continues until period_end.
 *
 * The actual mutation lives in `useCancelSubscription`; this modal is
 * presentation-only.
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { Button } from "@/design-system/primitives";
import { FocusTrap } from "@/presentation/components/a11y/FocusTrap";
import { formatDateLong } from "./utils";

interface CancelConfirmModalProps {
  open: boolean;
  /** ISO 8601 UTC of when access ends. */
  periodEndIso: string | null;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function CancelConfirmModal({
  open,
  periodEndIso,
  pending,
  error,
  onConfirm,
  onClose,
}: CancelConfirmModalProps): JSX.Element | null {
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, pending]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 6, 22, 0.65)",
        backdropFilter: "blur(2px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
      }}
    >
      <FocusTrap onEscape={pending ? undefined : onClose}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-sub-title"
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
          borderRadius: 22,
          boxShadow: "0 24px 60px rgba(8, 6, 22, 0.45)",
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
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
          }}
        >
          <h2
            id="cancel-sub-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.4px",
            }}
          >
            ¿Querés cancelar tu suscripción?
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Cerrar"
            style={{
              background: "transparent",
              border: "1px solid var(--color-amber-ink)",
              color: "var(--color-amber-ink)",
              borderRadius: 10,
              width: 32,
              height: 32,
              cursor: pending ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
              opacity: pending ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ padding: 20, overflow: "auto" }}>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--color-text)",
            }}
          >
            Tu acceso continúa hasta el{" "}
            <strong>{formatDateLong(periodEndIso)}</strong>. Después de
            esa fecha tu plan vuelve a Free y dejás de tener acceso a
            las features Pro/Premium.
          </p>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-text-mid)",
            }}
          >
            Vas a poder reactivar la suscripción en cualquier momento
            antes de esa fecha desde esta misma pantalla.
          </p>

          <label
            htmlFor="cancel-reason"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text)",
              margin: "0 0 6px",
            }}
          >
            ¿Querés contarnos por qué? (opcional)
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lo voy a usar de nuevo más adelante / Demasiado caro / Otra herramienta…"
            rows={3}
            disabled={pending}
            style={{
              width: "100%",
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 13,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-text)",
              resize: "vertical",
              outline: "none",
            }}
          />

          {error ? (
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
              {error}
            </p>
          ) : null}
        </div>

        <footer
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={pending}
          >
            Volver
          </Button>
          <Button
            variant="danger"
            size="md"
            disabled={pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? "Cancelando…" : "Cancelar suscripción"}
          </Button>
        </footer>
      </div>
      </FocusTrap>
    </div>
  );
}
