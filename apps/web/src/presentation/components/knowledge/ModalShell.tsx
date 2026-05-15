"use client";

/**
 * ModalShell — minimal accessible modal scaffold reused by preview / edit /
 * delete-confirm dialogs in the Knowledge Base UI.
 *
 * Behavior:
 *  - Escape closes the modal.
 *  - Clicking the backdrop closes the modal.
 *  - Body scroll is locked while open (avoid double scrollbars on long
 *    documents being previewed).
 *  - Focus is moved into the dialog on mount; restored on unmount.
 *
 * Kept local to /knowledge for now. If F4+ needs the same primitive we
 * promote it to design-system/.
 */

import { useEffect, useRef } from "react";
import type { JSX, ReactNode } from "react";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  width?: number;
}

export function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
  ariaLabel,
  width = 720,
}: ModalShellProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
        aria-label={ariaLabel ?? title}
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: width,
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
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.4px",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              width: 32,
              height: 32,
              cursor: "pointer",
              color: "var(--color-text)",
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px",
          }}
        >
          {children}
        </div>
        {footer ? (
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
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
