"use client";

/**
 * SessionActionsMenu — top-right 3-dots dropdown.
 *
 * Items:
 *  - "Compartir" (Pro+ gated via `useTierGate("share_links")`). When the
 *    user's tier doesn't unlock it, we still show the item but disable it
 *    and explain why on hover.
 *  - "Exportar" (nested submenu with txt / md / pdf). PDF is gated by
 *    `useTierGate("pdf_export")` — disabled on free tier with hint.
 *  - "Eliminar sesión" (danger red, fires the parent's `onDelete`).
 *
 * Why we don't use a portal: keeping the dropdown anchored relative to the
 * trigger keeps the implementation small and works inside Card/Header.
 * If layering ever becomes an issue we can promote it to a Portal later.
 *
 * Closes on:
 *  - clicking outside (document mousedown listener)
 *  - clicking a leaf action (after firing its handler)
 *  - Escape key
 */

import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { useTierGate } from "@/presentation/hooks/use-tier-gate";

type ExportFormat = "txt" | "md" | "pdf";

interface SessionActionsMenuProps {
  onDelete: () => void;
  onShare: () => void;
  onExport: (format: ExportFormat) => void;
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  txt: "Texto (.txt)",
  md: "Markdown (.md)",
  pdf: "PDF (.pdf)",
};

export function SessionActionsMenu({
  onDelete,
  onShare,
  onExport,
}: SessionActionsMenuProps): JSX.Element {
  const shareGate = useTierGate("share_links");
  const pdfGate = useTierGate("pdf_export");

  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExportOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOpen(false);
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = (): void => {
    setOpen(false);
    setExportOpen(false);
  };

  const handleShare = (): void => {
    if (!shareGate.available) return;
    close();
    onShare();
  };

  const handleExport = (fmt: ExportFormat): void => {
    if (fmt === "pdf" && !pdfGate.available) return;
    close();
    onExport(fmt);
  };

  const handleDelete = (): void => {
    close();
    onDelete();
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        aria-label="Acciones de la sesión"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          width: 36,
          height: 36,
          borderRadius: 999,
          border: "1px solid var(--color-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text)",
          background: "var(--color-bg)",
          transition: "background 120ms ease",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="19" cy="12" r="2" fill="currentColor" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 14,
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)",
            padding: 6,
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <MenuItem
            label="Compartir"
            disabled={!shareGate.available}
            hint={
              !shareGate.available
                ? "Disponible en Pro o superior"
                : undefined
            }
            onClick={handleShare}
          />

          <button
            type="button"
            role="menuitem"
            onClick={() => setExportOpen((v) => !v)}
            aria-expanded={exportOpen}
            style={menuRowStyle(false)}
          >
            <span>Exportar</span>
            <span
              aria-hidden="true"
              style={{
                fontSize: 12,
                color: "var(--color-text-mid)",
              }}
            >
              {exportOpen ? "▾" : "▸"}
            </span>
          </button>

          {exportOpen ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "4px 4px 4px 14px",
                borderLeft: "2px solid var(--color-border)",
                marginLeft: 8,
              }}
            >
              {(["txt", "md", "pdf"] as const).map((fmt) => {
                const disabled = fmt === "pdf" && !pdfGate.available;
                return (
                  <MenuItem
                    key={fmt}
                    label={FORMAT_LABEL[fmt]}
                    disabled={disabled}
                    hint={disabled ? "PDF requiere Pro" : undefined}
                    onClick={() => handleExport(fmt)}
                  />
                );
              })}
            </div>
          ) : null}

          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: "var(--color-border)",
              margin: "4px 6px",
            }}
          />

          <MenuItem
            label="Eliminar sesión"
            tone="danger"
            onClick={handleDelete}
          />
        </div>
      ) : null}
    </div>
  );
}

function menuRowStyle(danger: boolean): CSSProperties {
  return {
    all: "unset",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "9px 10px",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 10,
    color: danger ? "oklch(58% 0.22 25)" : "var(--color-text)",
  };
}

interface MenuItemProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger" | "default";
  hint?: string;
}

function MenuItem({
  label,
  onClick,
  disabled = false,
  tone = "default",
  hint,
}: MenuItemProps): JSX.Element {
  const danger = tone === "danger";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={hint}
      style={{
        ...menuRowStyle(danger),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span>{label}</span>
      {hint ? (
        <span
          aria-hidden="true"
          style={{
            fontSize: 10,
            color: "var(--color-text-dim)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.4px",
          }}
        >
          Pro
        </span>
      ) : null}
    </button>
  );
}
