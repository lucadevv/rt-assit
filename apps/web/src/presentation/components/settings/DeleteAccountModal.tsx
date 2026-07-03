"use client";

/**
 * DeleteAccountModal — GDPR data delete with double confirmation.
 *
 * UX:
 *   - Full-screen overlay with backdrop (ESC / click outside cancels).
 *   - Lists exactly what gets deleted in plain Spanish.
 *   - User must TYPE their email exactly to enable the destructive
 *     button — protects against accidental clicks.
 *   - On success the hook signs out + redirects to /sign-in.
 *
 * The modal is owned by AccountSection. Mounting is conditional so the
 * portal-style overlay only exists while open.
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button, Input } from "@/design-system/primitives";
import { useDeleteAccount } from "@/presentation/hooks/use-delete-account";
import { FocusTrap } from "@/presentation/components/a11y/FocusTrap";
import {
  easeOut,
  easeOutQuart,
  modalEntrance,
} from "@/lib/motion-presets";

interface DeleteAccountModalProps {
  open: boolean;
  email: string;
  onClose: () => void;
}

export function DeleteAccountModal({
  open,
  email,
  onClose,
}: DeleteAccountModalProps): JSX.Element | null {
  const { deleting, error, confirmDelete } = useDeleteAccount();
  const [confirmInput, setConfirmInput] = useState<string>("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Reset the input every time the modal opens so a previous attempt
  // doesn't leak in.
  useEffect(() => {
    if (open) setConfirmInput("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !deleting) onClose();
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
  }, [open, onClose, deleting]);

  if (!open) return null;

  const matches = confirmInput.trim().toLowerCase() === email.toLowerCase();

  return (
    <motion.div
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: easeOut }}
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
      <FocusTrap onEscape={deleting ? undefined : onClose}>
      <motion.div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        tabIndex={-1}
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={modalEntrance}
        transition={{ duration: 0.24, ease: easeOutQuart }}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          background: "var(--color-bg-warm)",
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
            id="delete-account-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.4px",
            }}
          >
            ⚠ Eliminar mi cuenta
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            aria-label="Cerrar"
            style={{
              background: "transparent",
              border: "1px solid var(--color-amber-ink)",
              color: "var(--color-amber-ink)",
              borderRadius: 10,
              width: 32,
              height: 32,
              cursor: deleting ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
              opacity: deleting ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ padding: 20, overflow: "auto" }}>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            Esta acción es <strong>irreversible</strong>. Vamos a eliminar:
          </p>
          <ul
            style={{
              margin: "0 0 16px",
              paddingLeft: 22,
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--color-text)",
            }}
          >
            <li>Tu CV y todos los documentos cargados.</li>
            <li>Tu historial de sesiones, transcripciones y hints.</li>
            <li>Tus grabaciones (si tu plan las almacena).</li>
            <li>Tus preferencias y atajos personalizados.</li>
            <li>Tu suscripción se cancela automáticamente.</li>
          </ul>

          <p
            style={{
              margin: "0 0 8px",
              fontSize: 14,
              color: "var(--color-text)",
            }}
          >
            Para confirmar, escribí tu email exacto:
          </p>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              fontFamily:
                "var(--font-mono)",
              color: "var(--color-text-mid)",
            }}
          >
            {email}
          </p>
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="off"
            spellCheck={false}
            disabled={deleting}
            invalid={confirmInput.length > 0 && !matches}
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
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="md"
            disabled={!matches || deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? "Eliminando…" : "Eliminar mi cuenta"}
          </Button>
        </footer>
      </motion.div>
      </FocusTrap>
    </motion.div>
  );
}
