"use client";

/**
 * /app/meetings — Sprint 1.5.
 *
 * Lists the meetings the user has created from Susurra (currently Meet
 * only; Teams + Zoom will join the list in Sprints 2/3 without code
 * changes — the backend endpoint is already provider-agnostic).
 *
 * Composition:
 *  - Header (italic accent + subtitle + CTA "Crear desde Nueva Sesión").
 *  - Card-per-meeting with [Abrir] / [Copiar link] / [Eliminar] actions.
 *  - Confirm dialog for delete.
 *  - Empty state with CTA when the user hasn't created any meeting.
 *
 * Data flow: `useMyMeetings` hook (CRUD over the meetings list — see
 * `presentation/hooks/use-my-meetings.ts`).
 */

import { useCallback, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Button, Card, Pill } from "@/design-system/primitives";
import { ArrowRightIcon, MonitorIcon, XIcon } from "@/design-system/icons";
import { useMyMeetings } from "@/presentation/hooks/use-my-meetings";
import type { Meeting } from "@/domain/entities/meeting";

export default function MeetingsPage(): JSX.Element {
  const { meetings, loading, error, hasFetched, remove } = useMyMeetings();
  const [pendingDelete, setPendingDelete] = useState<Meeting | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (meeting: Meeting): Promise<void> => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(meeting.joinUrl);
        setCopiedId(meeting.id);
        window.setTimeout(() => setCopiedId(null), 1500);
      }
    } catch {
      // Clipboard might be blocked in non-secure contexts. We swallow
      // silently — the URL is still visible in the card.
    }
  }, []);

  const handleOpen = useCallback((meeting: Meeting): void => {
    if (typeof window === "undefined") return;
    window.open(meeting.joinUrl, "_blank", "noopener,noreferrer");
  }, []);

  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      // Error already surfaced via the hook's `error` state.
    }
  }, [pendingDelete, remove]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1100,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill variant="lavender">Meeting Frame</Pill>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1
              style={{
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-1.4px",
                margin: 0,
              }}
            >
              Tus <span className="italic-accent">reuniones</span>
            </h1>
            <p
              style={{
                color: "var(--color-text-mid)",
                fontSize: 16,
                maxWidth: 640,
                margin: 0,
              }}
            >
              Reuniones que creaste desde Susurra. Compartilas con tu equipo
              y abrilas para que Susurra te acompañe en vivo vía tab-share.
            </p>
          </div>
          <Link href="/app" style={{ textDecoration: "none" }}>
            <Button
              variant="primary"
              size="md"
              trailingIcon={<ArrowRightIcon size={16} />}
            >
              Crear desde Nueva Sesión
            </Button>
          </Link>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.4)",
            borderRadius: 14,
            padding: "12px 16px",
            color: "var(--color-text)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {!hasFetched || loading ? (
        <div
          style={{
            color: "var(--color-text-mid)",
            fontSize: 14,
            padding: 16,
          }}
        >
          Cargando reuniones…
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {meetings.map((m) => (
            <li key={m.id}>
              <MeetingCard
                meeting={m}
                copied={copiedId === m.id}
                onOpen={() => handleOpen(m)}
                onCopy={() => {
                  void handleCopy(m);
                }}
                onDelete={() => setPendingDelete(m)}
              />
            </li>
          ))}
        </ul>
      )}

      {pendingDelete ? (
        <DeleteMeetingDialog
          meeting={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// MeetingCard — one row per meeting
// ---------------------------------------------------------------------

function MeetingCard({
  meeting,
  copied,
  onOpen,
  onCopy,
  onDelete,
}: {
  meeting: Meeting;
  copied: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
}): JSX.Element {
  const code = extractCode(meeting.joinUrl);
  return (
    <Card
      variant="soft"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 18px",
        borderRadius: 16,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text)",
          flexShrink: 0,
        }}
      >
        <MonitorIcon size={20} />
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.2px",
            color: "var(--color-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {meeting.title && meeting.title.trim().length > 0
            ? meeting.title
            : "Reunión sin título"}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--color-text-mid)",
          }}
        >
          {code ?? meeting.joinUrl}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-dim, var(--color-text-mid))",
          }}
        >
          Creada el {formatDate(meeting.createdAt)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexShrink: 0,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <Button variant="ghost" size="sm" onClick={onOpen}>
          Abrir
        </Button>
        <Button variant="ghost" size="sm" onClick={onCopy}>
          {copied ? "¡Copiado!" : "Copiar link"}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          Eliminar
        </Button>
      </div>
    </Card>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div
      style={{
        border: "1px dashed var(--color-border)",
        borderRadius: 18,
        padding: 32,
        background: "var(--color-bg-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span aria-hidden style={{ fontSize: 36 }}>
        {"\u{1F4F9}"}
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.4px",
        }}
      >
        Todavía no creaste reuniones
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--color-text-mid)",
          maxWidth: 520,
          lineHeight: 1.5,
        }}
      >
        Las reuniones se crean desde el modal Nueva Sesión. Una vez
        generadas, las vas a poder reutilizar y compartir desde acá.
      </p>
      <Link href="/app" style={{ textDecoration: "none" }}>
        <Button
          variant="primary"
          size="md"
          trailingIcon={<ArrowRightIcon size={16} />}
        >
          Crear desde Nueva Sesión
        </Button>
      </Link>
    </div>
  );
}

function DeleteMeetingDialog({
  meeting,
  onCancel,
  onConfirm,
}: {
  meeting: Meeting;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 6, 22, 0.55)",
        backdropFilter: "blur(2px)",
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5vh 16px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar eliminación"
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--color-bg)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
          borderRadius: 18,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 24px 60px rgba(8, 6, 22, 0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            Eliminar reunión
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            disabled={submitting}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              width: 28,
              height: 28,
              cursor: submitting ? "not-allowed" : "pointer",
              color: "var(--color-text-mid)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={14} />
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          ¿Seguro que querés borrar{" "}
          <strong>
            {meeting.title && meeting.title.trim().length > 0
              ? meeting.title
              : "esta reunión"}
          </strong>
          ? Susurra ya no la va a mostrar acá. La reunión en el proveedor
          (Google Meet) sigue existiendo hasta que se borre desde allá.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function extractCode(joinUrl: string): string | null {
  // Google Meet: https://meet.google.com/abc-defg-hij → abc-defg-hij.
  try {
    const url = new URL(joinUrl);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}
