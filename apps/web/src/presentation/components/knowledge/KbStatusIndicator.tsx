"use client";

/**
 * KbStatusIndicator — TopBar pill showing whether the user has uploaded
 * their CV (FR-31 / TopBar contract).
 *
 * - "CV ✓" lima si hasCv (link al /app/knowledge igual, por consistencia).
 * - "CV ×" gris si !hasCv (clickeable → empuja al user a /app/knowledge).
 *
 * Reuses the shared documents store so the request fires only once
 * across the app session (the /knowledge page mounts the same hook and
 * reuses the cached list).
 */

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useDocuments } from "@/presentation/hooks/use-documents";

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.6px",
  textTransform: "uppercase",
  fontFamily: "var(--font-inter)",
  cursor: "pointer",
  border: "1px solid transparent",
  lineHeight: 1.05,
};

export function KbStatusIndicator(): JSX.Element {
  const router = useRouter();
  const { hasCv, hasFetched } = useDocuments();

  const onClick = () => {
    router.push("/app/knowledge");
  };

  if (!hasFetched) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Knowledge Base"
        aria-label="Ir a tu base de conocimiento"
        style={{
          ...baseStyle,
          background: "transparent",
          color: "var(--color-text-mid)",
          border: "1px solid var(--color-border)",
        }}
      >
        CV …
      </button>
    );
  }

  if (hasCv) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Tu CV está cargado — ir al Knowledge Base"
        aria-label="Tu CV está cargado, ir al Knowledge Base"
        style={{
          ...baseStyle,
          background: "var(--color-lime)",
          color: "var(--color-lime-ink)",
        }}
      >
        <span aria-hidden>✓</span>
        CV
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Aún no subiste tu CV — sumalo en Knowledge"
      aria-label="Aún no subiste tu CV, ir al Knowledge Base"
      style={{
        ...baseStyle,
        background: "transparent",
        color: "var(--color-text-mid)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span aria-hidden>×</span>
      CV
    </button>
  );
}
