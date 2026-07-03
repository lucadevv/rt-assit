"use client";

/**
 * DocumentCard — list row for a single KB document.
 *
 * - Type icon + colored Pill (matches scenario palette where applicable).
 * - Title (clickable → preview modal).
 * - Meta: doc_type label + scenario badge (if scoped) + size + date.
 * - Primary toggle (star): marks the doc as the identity-primary for its
 *   scope (global vs scenario). Filled when `isPrimary === true`.
 * - Actions: Ver / Editar / Eliminar.
 *
 * Spanish UX strings throughout.
 */

import type { JSX } from "react";
import { Pill } from "@/design-system/primitives";
import { DocIcon } from "@/design-system/icons";
import {
  DOC_TYPE_ICONS,
  DOC_TYPE_LABELS,
  type DocumentListItem,
} from "@/domain/entities/document";
import { formatDate, formatSize, pillVariantForDocType } from "./utils";

interface DocumentCardProps {
  doc: DocumentListItem;
  scenarioLabel?: string | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePrimary?: (next: boolean) => void;
}

const buttonStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  background: "transparent",
  color: "var(--color-text)",
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export function DocumentCard({
  doc,
  scenarioLabel,
  onView,
  onEdit,
  onDelete,
  onTogglePrimary,
}: DocumentCardProps): JSX.Element {
  const isPrimary = doc.isPrimary === true;
  const primaryHint = isPrimary
    ? "Marcado como principal"
    : "Marcar como identidad principal";

  return (
    <article
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: 16,
        border: isPrimary
          ? "1px solid var(--color-amber)"
          : "1px solid var(--color-border)",
        background: "var(--color-bg-soft)",
        boxShadow: "var(--shadow-card-1)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
    >
      {onTogglePrimary ? (
        <button
          type="button"
          onClick={() => onTogglePrimary(!isPrimary)}
          aria-label={primaryHint}
          aria-pressed={isPrimary}
          title={primaryHint}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isPrimary
              ? "var(--color-amber-ink, oklch(58% 0.18 70))"
              : "var(--color-text-mid)",
            transition: "color 120ms ease, transform 120ms ease",
          }}
        >
          <StarIcon filled={isPrimary} />
        </button>
      ) : null}
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-bg-soft)",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        <span>{DOC_TYPE_ICONS[doc.docType] ?? "📄"}</span>
      </div>
      <div
        style={{
          minWidth: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <button
          type="button"
          onClick={onView}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--color-text)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.2px",
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%",
          }}
          title={doc.title}
        >
          {doc.title}
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--color-text-mid)",
          }}
        >
          <Pill variant={pillVariantForDocType(doc.docType)}>
            {DOC_TYPE_LABELS[doc.docType]}
          </Pill>
          {doc.scenario ? (
            <Pill variant="ghost">
              {scenarioLabel ?? doc.scenario}
            </Pill>
          ) : (
            <Pill variant="ghost">Global</Pill>
          )}
          {isPrimary ? <Pill variant="amber">Principal</Pill> : null}
          <span aria-hidden>·</span>
          <span>{formatSize(doc.sizeChars)}</span>
          <span aria-hidden>·</span>
          <span>{formatDate(doc.uploadedAt)}</span>
          {doc.source ? (
            <>
              <span aria-hidden>·</span>
              <span
                title={doc.source}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <DocIcon size={12} />
                {doc.source}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button type="button" style={buttonStyle} onClick={onView}>
          Ver
        </button>
        <button type="button" style={buttonStyle} onClick={onEdit}>
          Editar
        </button>
        <button
          type="button"
          style={{
            ...buttonStyle,
            color: "var(--color-danger)",
            borderColor: "color-mix(in srgb, var(--color-danger) 50%, transparent)",
          }}
          onClick={onDelete}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}

interface StarIconProps {
  filled: boolean;
  size?: number;
}

function StarIcon({ filled, size = 20 }: StarIconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.75 14.85 9 21.75 10 16.75 14.5 18.25 21.25 12 17.75 5.75 21.25 7.25 14.5 2.25 10 9.15 9 Z" />
    </svg>
  );
}
