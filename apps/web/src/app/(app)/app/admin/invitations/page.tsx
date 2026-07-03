"use client";

/**
 * /app/admin/invitations — Founder-only invitations workflow.
 *
 * Composition:
 *  - Header (italic accent + subtitle).
 *  - Form: email input + "Invitar" button → POST /api/admin/invitations.
 *  - Feedback strip: success/error after submit.
 *  - List: past invitations (newest-first) with email-delivery + login state.
 *
 * Security model:
 *  - The route only renders content when `user.isAdmin === true`. A
 *    non-admin user who navigates here is redirected to /app.
 *  - The hide-the-link UX is purely cosmetic — the endpoints enforce
 *    `is_admin === True` server-side, so a curl-toting non-admin user
 *    still hits a 403 if they try to bypass the gate.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, JSX } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
import { Button, Card, Input, Pill, Spinner } from "@/design-system/primitives";
import {
  fadeUpSubtle,
  transitionBase,
  transitionEntrance,
} from "@/lib/motion-presets";
import type { BetaInvitation } from "@/domain/entities/beta-invitation";

type FeedbackTone = "success" | "warning" | "error";

interface Feedback {
  tone: FeedbackTone;
  message: string;
}

export default function AdminInvitationsPage(): JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const { inviteBetaUser, listInvitations } = useContainer();

  const [invitations, setInvitations] = useState<BetaInvitation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const isMountedRef = useRef(true);

  // Gate: non-admin users get bounced to the home dashboard. We wait for
  // auth to finish loading so we don't flicker-redirect during the very
  // first /api/me round-trip.
  useEffect(() => {
    if (!authLoading && user && !user.isAdmin) {
      router.replace("/app");
    }
  }, [authLoading, user, router]);

  const fetchInvitations = useCallback(async (): Promise<void> => {
    try {
      const fresh = await listInvitations.execute();
      if (!isMountedRef.current) return;
      setInvitations(fresh);
      setListError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos cargar las invitaciones.";
      setListError(message);
    } finally {
      if (isMountedRef.current) {
        setListLoading(false);
      }
    }
  }, [listInvitations]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!user?.isAdmin) return;
    void fetchInvitations();
    return () => {
      isMountedRef.current = false;
    };
  }, [user?.isAdmin, fetchInvitations]);

  const trimmedEmail = emailInput.trim();
  const submitDisabled = submitting || trimmedEmail.length === 0;

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      if (submitDisabled) return;
      setSubmitting(true);
      setFeedback(null);
      try {
        const result = await inviteBetaUser.execute(trimmedEmail);
        if (result.emailSent) {
          setFeedback({
            tone: "success",
            message: `Invitación enviada a ${result.email}. El email salió en camino.`,
          });
        } else {
          setFeedback({
            tone: "warning",
            message: `Usuario creado, pero el email no se entregó. Revisá la config de Resend y reintentá manualmente con ${result.email}.`,
          });
        }
        setEmailInput("");
        await fetchInvitations();
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Error desconocido.";
        const message = raw.includes("409")
          ? "Ese email ya tiene cuenta. Probá con otro."
          : raw.includes("403")
            ? "No tenés permisos para invitar."
            : `No pudimos enviar la invitación: ${raw}`;
        setFeedback({ tone: "error", message });
      } finally {
        setSubmitting(false);
      }
    },
    [submitDisabled, trimmedEmail, inviteBetaUser, fetchInvitations],
  );

  const sortedInvitations = useMemo(
    () =>
      [...invitations].sort(
        (a, b) =>
          new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime(),
      ),
    [invitations],
  );

  if (authLoading || !user) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 24,
          color: "var(--color-text-mid)",
          fontSize: 14,
        }}
      >
        <Spinner size={18} />
        <span>Cargando…</span>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--color-text-mid)",
          fontSize: 14,
        }}
      >
        Esta sección es solo para el equipo fundador.
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpSubtle}
      transition={transitionEntrance}
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
          <Pill variant="lavender">Admin</Pill>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "-1.4px",
              margin: 0,
            }}
          >
            Invitaciones a <span className="italic-accent">beta</span>
          </h1>
          <p
            style={{
              color: "var(--color-text-mid)",
              fontSize: 16,
              maxWidth: 640,
              margin: 0,
            }}
          >
            Mandá invitaciones a devs LATAM. Susurra crea la cuenta y manda
            las credenciales por email — sin curl, sin pegar contraseñas a
            mano.
          </p>
        </div>
      </header>

      <Card variant="soft" padded={false} style={{ padding: 22 }}>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              htmlFor="invite-email"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text)",
                letterSpacing: "-0.1px",
              }}
            >
              Email del invitado
            </label>
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-mid)",
                lineHeight: 1.5,
              }}
            >
              Susurra genera una contraseña segura y la manda al email.
              El usuario puede cambiarla apenas entra.
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1, minWidth: 260 }}>
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="dev@ejemplo.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitDisabled}
            >
              {submitting ? "Invitando…" : "Invitar"}
            </Button>
          </div>

          {feedback ? (
            <motion.div
              key={feedback.message}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitionBase}
              role={feedback.tone === "error" ? "alert" : "status"}
              style={{
                background: feedbackBg(feedback.tone),
                border: `1px solid ${feedbackBorder(feedback.tone)}`,
                color: "var(--color-text)",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {feedback.message}
            </motion.div>
          ) : null}
        </form>
      </Card>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            Últimas invitaciones
          </h2>
          <span
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--color-text-dim, var(--color-text-mid))",
            }}
          >
            {sortedInvitations.length} en total
          </span>
        </div>

        {listError ? (
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
            {listError}
          </div>
        ) : null}

        {listLoading ? (
          <div
            style={{
              color: "var(--color-text-mid)",
              fontSize: 14,
              padding: 16,
            }}
          >
            Cargando invitaciones…
          </div>
        ) : sortedInvitations.length === 0 ? (
          <EmptyState />
        ) : (
          <InvitationsTable invitations={sortedInvitations} />
        )}
      </section>
    </motion.div>
  );
}

// ---------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------

function InvitationsTable({
  invitations,
}: {
  invitations: BetaInvitation[];
}): JSX.Element {
  return (
    <Card variant="soft" padded={false} style={{ overflow: "hidden" }}>
      <div
        role="table"
        aria-label="Invitaciones enviadas"
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2.2fr) 1.1fr 1.1fr 1.1fr",
            gap: 14,
            padding: "12px 18px",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            fontSize: 11,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--color-text-dim, var(--color-text-mid))",
            fontWeight: 600,
          }}
        >
          <span role="columnheader">Email</span>
          <span role="columnheader">Enviada</span>
          <span role="columnheader">Email entregado</span>
          <span role="columnheader">Último login</span>
        </div>
        {invitations.map((inv) => (
          <InvitationRow key={inv.id} invitation={inv} />
        ))}
      </div>
    </Card>
  );
}

function InvitationRow({
  invitation,
}: {
  invitation: BetaInvitation;
}): JSX.Element {
  return (
    <div
      role="row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2.2fr) 1.1fr 1.1fr 1.1fr",
        gap: 14,
        padding: "14px 18px",
        borderBottom: "1px solid var(--color-border)",
        alignItems: "center",
        fontSize: 13,
        color: "var(--color-text)",
      }}
    >
      <span
        role="cell"
        style={{
          fontWeight: 600,
          letterSpacing: "-0.1px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {invitation.email}
      </span>
      <span
        role="cell"
        className="mono"
        style={{ color: "var(--color-text-mid)", fontSize: 12 }}
      >
        {formatDate(invitation.invitedAt)}
      </span>
      <span role="cell">
        <StatusPill
          tone={invitation.emailSent ? "ok" : "warn"}
          label={invitation.emailSent ? "Entregado" : "No entregado"}
        />
      </span>
      <span
        role="cell"
        className="mono"
        style={{
          color: invitation.hasLoggedIn
            ? "var(--color-text)"
            : "var(--color-text-dim, var(--color-text-mid))",
          fontSize: 12,
        }}
      >
        {invitation.lastLoginAt ? formatDate(invitation.lastLoginAt) : "—"}
      </span>
    </div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "ok" | "warn";
  label: string;
}): JSX.Element {
  const { bg, border, color } =
    tone === "ok"
      ? {
          bg: "rgba(132, 204, 22, 0.14)",
          border: "rgba(132, 204, 22, 0.45)",
          color: "var(--color-text)",
        }
      : {
          bg: "rgba(234, 179, 8, 0.14)",
          border: "rgba(234, 179, 8, 0.45)",
          color: "var(--color-text)",
        };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "-0.1px",
      }}
    >
      {label}
    </span>
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
      <h3
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.3px",
        }}
      >
        Todavía no invitaste a nadie
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--color-text-mid)",
          maxWidth: 520,
          lineHeight: 1.5,
        }}
      >
        Empezá con el email de alguien que quieras dejar entrar a la beta.
        Susurra arma la cuenta y manda las credenciales. El usuario solo
        tiene que entrar.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function feedbackBg(tone: FeedbackTone): string {
  switch (tone) {
    case "success":
      return "rgba(132, 204, 22, 0.12)";
    case "warning":
      return "rgba(234, 179, 8, 0.14)";
    case "error":
      return "rgba(220, 38, 38, 0.10)";
  }
}

function feedbackBorder(tone: FeedbackTone): string {
  switch (tone) {
    case "success":
      return "rgba(132, 204, 22, 0.45)";
    case "warning":
      return "rgba(234, 179, 8, 0.45)";
    case "error":
      return "rgba(220, 38, 38, 0.45)";
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
