"use client";

/**
 * NewSessionModal — single entry point for creating a session.
 *
 * Architecture invariant (architecture/single-path-session-creation):
 *   This modal is the ONLY surface in the entire app that POSTs to
 *   `/api/sessions`. The live page (`/app/live`) is purely a "connect
 *   to an existing session" surface — it never creates one. That
 *   eliminates the duplicate-session bug where bare /app/live mounts
 *   or post-modal `router.replace` race conditions caused a second
 *   POST against the same intent.
 *
 * Flow:
 *   1. User fills the form (scenario, language, record, docs, name).
 *   2. On submit, we POST the session row via `createSession.execute`.
 *   3. We navigate to `/app/live?sessionId={createdId}`.
 *   4. The live page reads the id from the URL and hydrates the session
 *      store via `getSessionDetail`. From that point on, every detail
 *      the modal collected (scenario, language, record, document ids)
 *      lives on the server-persisted row and is recovered from there.
 *      There is NO in-memory draft store any more — the URL plus the
 *      backend row are the single channel.
 *
 * Why URL (and not Zustand) for the sessionId:
 *  - Under React Strict Mode + HMR + occasional unmount, an in-memory
 *    Zustand draft would sometimes clear between modal close and the
 *    "Iniciar captura" click, causing the old hook to fall through to
 *    a second `createSession` call. The URL survives all of that.
 *
 * Why POST before navigating (and not after):
 *  - The audio capture API requires a user gesture INSIDE /app/live for
 *    `getDisplayMedia()` to prompt the screen-share picker. We still
 *    accept that some users will close the tab before audio flows — a
 *    backend cron (`cleanup_abandoned_sessions`, every 5 min) reaps any
 *    session row with zero transcripts whose `started_at` is older than
 *    the timeout.
 *
 * Tier gating:
 *  - The recording toggle is the only tier-gated control. We check
 *    `user.tier` directly (Free → locked) because `useTierGate` requires
 *    `useBilling` to have populated the billing store, which only happens
 *    once the user has visited /app/billing. Tier from /api/me is
 *    available everywhere as soon as the user is authenticated.
 *
 * Doc filter logic:
 *  - Shows every user document whose `docType` is in the scenario's
 *    `doc_types` (== backend `relevant_doc_types`).
 *  - Pre-checked: any doc with `isPrimary === true` AND any doc whose
 *    docType is in the scenario's identity-doc types (cv / profile /
 *    persona — the prompt builder's "identity" channel). User can toggle.
 *  - If the scenario exposes zero `doc_types`, the docs section is
 *    hidden entirely (matches the spec's "no relevant docs → skip").
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, JSX } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Pill, Select, Toggle } from "@/design-system/primitives";
import { ArrowRightIcon, CheckIcon, MicIcon, PlusIcon, XIcon } from "@/design-system/icons";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { useDocuments } from "@/presentation/hooks/use-documents";
import { usePersonas } from "@/presentation/hooks/use-personas";
import { useCurrentUser } from "@/presentation/hooks/use-current-user";
import { useMeet } from "@/presentation/hooks/use-meet";
import { useIntegrations } from "@/presentation/hooks/use-integrations";
import { useContainer } from "@/infrastructure/di/container";
import { useSessionStore } from "@/application/stores/session.store";
import { useAgentStore } from "@/application/stores/agent.store";
import type { Scenario, ScenarioColor } from "@/domain/entities/scenario";
import { scenarioColorOf } from "@/domain/entities/scenario";
import type { SessionMode } from "@/domain/entities/session";
import {
  DOC_TYPE_ICONS,
  DOC_TYPE_LABELS,
  isDocType,
  normaliseDocType,
} from "@/domain/entities/document";
import type { DocType, DocumentListItem } from "@/domain/entities/document";
import type { SessionMaterialType } from "@/domain/entities/session-material";
import {
  SESSION_MATERIAL_TYPE_ICONS,
  SESSION_MATERIAL_TYPE_LABELS,
} from "@/domain/entities/session-material";
import type { CreateSessionMaterialInput } from "@/application/ports/session-materials-api.port";

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
}

type LangOption = "es-419" | "es-ES" | "en-US";

const LANG_OPTIONS: ReadonlyArray<{ value: LangOption; label: string }> = [
  { value: "es-419", label: "Español (LATAM)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "en-US", label: "English (US)" },
];

/**
 * Doc types treated as "identity" — pre-checked when the scenario
 * surfaces them, regardless of whether the user marked one as primary.
 * Mirrors the backend prompt builder's identity channel.
 */
const IDENTITY_DOC_TYPES: ReadonlySet<DocType> = new Set([
  "cv",
  "profile",
  "persona",
]);

const COLOR_BG: Record<ScenarioColor, string> = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
};

const COLOR_BG_SOFT: Record<ScenarioColor, string> = {
  cyan: "color-mix(in oklab, var(--color-cyan) 18%, var(--color-bg))",
  amber: "color-mix(in oklab, var(--color-amber) 18%, var(--color-bg))",
  lavender: "color-mix(in oklab, var(--color-lavender) 18%, var(--color-bg))",
  lime: "color-mix(in oklab, var(--color-lime) 18%, var(--color-bg))",
};

const COLOR_RING: Record<ScenarioColor, string> = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
};

/**
 * Format the auto-name fallback as `{scenario_label} · {dd/MM/yyyy HH:mm}`
 * in the user's es-AR locale.
 *
 * Exported (named) so the unit tests in the same folder can lock the
 * format if it ever drifts — Wave 2B contract.
 */
export function formatAutoName(scenarioLabel: string, when: Date): string {
  const fmt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return `${scenarioLabel} · ${fmt.format(when)}`;
}

export function NewSessionModal({
  open,
  onClose,
}: NewSessionModalProps): JSX.Element | null {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { available: scenarios, current: globalScenarioId, setCurrent } =
    useScenarios();
  const { documents, hasFetched: docsFetched } = useDocuments();
  const { personas, defaultPersona, hasFetched: personasFetched } =
    usePersonas();
  const { createSession, createSessionMaterial } = useContainer();

  // ---------- Local form state ----------
  const [name, setName] = useState("");
  const [scenarioId, setScenarioId] = useState<string | null>(
    globalScenarioId ?? null,
  );
  const [language, setLanguage] = useState<LangOption>("es-419");
  const [record, setRecord] = useState(false);
  const [docSelections, setDocSelections] = useState<Map<number, boolean>>(
    new Map(),
  );
  const [personaId, setPersonaId] = useState<number | null>(null);
  // Susurra mode — default "agent" preserves the pre-toggle UX (first-person
  // responses). "scribe" switches the backend prompt to structured
  // note-taking and the /app/live UI to markdown rendering.
  const [mode, setMode] = useState<SessionMode>("agent");
  // Local material drafts — POSTed to the backend AFTER the session is
  // created. No API call yet.
  const [materialDrafts, setMaterialDrafts] = useState<
    ReadonlyArray<CreateSessionMaterialInput>
  >([]);
  // Sprint 1.5 — meeting created from the optional MeetMeetingSection.
  // When set, we forward its id as `meetingId` on the create-session
  // payload so the backend persists the FK.
  const [createdMeeting, setCreatedMeeting] = useState<{
    id: string;
    joinUrl: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial language: prefer user.languagePreferred if it matches one of
  // the three offered locales; otherwise keep the es-419 default.
  const languageSeededRef = useRef(false);
  useEffect(() => {
    if (languageSeededRef.current) return;
    if (!user) return;
    languageSeededRef.current = true;
    const pref = user.languagePreferred;
    if (pref === "es-419" || pref === "es-ES" || pref === "en-US") {
      setLanguage(pref);
    }
  }, [user]);

  // When the modal opens, seed scenario from the global current pick
  // (if any) so the user lands on something selected.
  useEffect(() => {
    if (!open) return;
    if (scenarioId === null && globalScenarioId) {
      setScenarioId(globalScenarioId);
    }
  }, [open, globalScenarioId, scenarioId]);

  // Seed the persona selector with the user's default persona (if any)
  // every time the modal opens. The user can still override per session.
  useEffect(() => {
    if (!open) return;
    if (personaId !== null) return;
    if (defaultPersona) {
      setPersonaId(defaultPersona.id);
    }
  }, [open, defaultPersona, personaId]);

  // Reset transient state every time the modal opens — submitting/error
  // should never bleed from a previous attempt. Also discard any half-
  // built material drafts so a previous attempt doesn't leak.
  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
    setMaterialDrafts([]);
    setCreatedMeeting(null);
  }, [open]);

  // ---------- Escape + body scroll lock + focus trap ----------
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return (): void => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, submitting]);

  // ---------- Derived ----------
  const selectedScenario = useMemo<Scenario | null>(() => {
    if (!scenarioId) return null;
    return scenarios.find((s) => s.id === scenarioId) ?? null;
  }, [scenarioId, scenarios]);

  const relevantDocTypes = useMemo<ReadonlySet<DocType>>(() => {
    if (!selectedScenario) return new Set<DocType>();
    const next = new Set<DocType>();
    for (const raw of selectedScenario.doc_types) {
      if (isDocType(raw)) {
        next.add(raw);
      }
    }
    return next;
  }, [selectedScenario]);

  const relevantDocs = useMemo<DocumentListItem[]>(() => {
    if (!selectedScenario || relevantDocTypes.size === 0) return [];
    return documents.filter((d) => {
      const t = normaliseDocType(d.docType);
      if (!relevantDocTypes.has(t)) return false;
      // Scenario-scoped docs (job_offer, meeting_brief, exam_syllabus,
      // persona) must match the chosen scenario id; global docs (cv,
      // profile, reference) match for every scenario.
      if (d.scenario === null) return true;
      return d.scenario === selectedScenario.id;
    });
  }, [documents, relevantDocTypes, selectedScenario]);

  // When the scenario changes, reset the selection map to the defaults:
  // pre-check `is_primary` docs AND any doc with an identity doc_type.
  useEffect(() => {
    if (!selectedScenario) {
      setDocSelections(new Map());
      return;
    }
    const next = new Map<number, boolean>();
    for (const doc of relevantDocs) {
      const t = normaliseDocType(doc.docType);
      const isIdentityType = IDENTITY_DOC_TYPES.has(t);
      const isPrimary = doc.isPrimary === true;
      if (isIdentityType || isPrimary) {
        next.set(doc.id, true);
      }
    }
    setDocSelections(next);
  }, [selectedScenario, relevantDocs]);

  const scenarioLabel = selectedScenario?.label ?? "Sesión";
  const placeholder = useMemo(
    () => formatAutoName(scenarioLabel, new Date()),
    [scenarioLabel],
  );

  const canRecord = user ? user.tier !== "free" : false;
  // If the user toggled "record" on while on a paid tier and then
  // downgraded mid-session (unlikely but cheap to guard) we coerce it back
  // to `false` for the payload.
  const effectiveRecord = canRecord ? record : false;

  const canSubmit = scenarioId !== null && !submitting;

  // ---------- Handlers ----------
  const toggleDoc = (docId: number): void => {
    setDocSelections((prev) => {
      const next = new Map(prev);
      next.set(docId, !prev.get(docId));
      return next;
    });
  };

  const handleClose = (): void => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    if (!scenarioId || !selectedScenario) {
      setError("Elegí un escenario para empezar.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const documentIds: number[] = [];
    for (const [id, checked] of docSelections.entries()) {
      if (checked) documentIds.push(id);
    }
    const trimmedName = name.trim();
    const resolvedName =
      trimmedName.length > 0
        ? trimmedName
        : formatAutoName(selectedScenario.label, new Date());

    // Wave 2B: persist the session in the backend BEFORE navigating, so
    // it survives a tab close before the user clicks "Iniciar captura".
    // `useLiveSession.start` will reuse this id instead of creating a
    // second session.
    //
    // H3: the persona_id is threaded into the session row via the
    // `metadata` channel — the backend prompt builder reads
    // `metadata.persona_id` to enrich its identity/instructions block.
    // This is the same channel `document_ids` uses, so older backends
    // ignore the new key silently.
    const sessionMetadata: Record<string, unknown> = {};
    if (personaId !== null) {
      sessionMetadata["persona_id"] = personaId;
    }

    let createdSessionId: string;
    try {
      const created = await createSession.execute({
        scenario: scenarioId,
        myLanguage: language,
        otherLanguage: language,
        isRecording: effectiveRecord,
        title: resolvedName,
        documentIds,
        mode,
        // Sprint 1.5 — forward the optional Meeting FK so /app/live can
        // surface the join URL.
        ...(createdMeeting ? { meetingId: createdMeeting.id } : {}),
        ...(Object.keys(sessionMetadata).length > 0
          ? { metadata: sessionMetadata }
          : {}),
      });
      createdSessionId = created.id;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos crear la sesión. Probá de nuevo.";
      setError(message);
      setSubmitting(false);
      return;
    }

    // H3: POST each material draft against the just-created session.
    // Failures are logged but do NOT roll back the session — the user
    // can re-add materials from the session detail page later. We use
    // Promise.allSettled so a single 404/500 from one material doesn't
    // block the rest (or the navigation).
    if (materialDrafts.length > 0) {
      const ops = materialDrafts.map((draft) =>
        createSessionMaterial.execute(createdSessionId, draft),
      );
      const results = await Promise.allSettled(ops);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        // Non-blocking: surface a warning in the console but proceed
        // with navigation. The user can re-add from the session row.
        // eslint-disable-next-line no-console
        console.warn(
          `[susurra] ${failed}/${materialDrafts.length} session materials failed to attach.`,
        );
      }
    }

    // Single-path-creation: no in-memory draft store. Every detail the
    // form collected is now persisted in the backend row we just POSTed
    // and the live page recovers it via `getSessionDetail`. The URL
    // carries the single piece of state /app/live needs to know about:
    // which session id to hydrate.
    //
    // Sync the global current scenario so the live screen reflects the
    // chosen scenario in the TopBar (and the speaker colors match).
    setCurrent(scenarioId);

    // Cross-session-leak guard (bugfix/cross-session-store-leak):
    // Clear any session / agent state from a previously-finalised (or
    // simply abandoned) session BEFORE we navigate, so the /app/live
    // mount starts with an empty slate. The useLiveSession mount effect
    // also resets defensively — this here is the first line of defence
    // so even a microtask-level subscriber sees a clean store.
    useSessionStore.getState().reset();
    useAgentStore.getState().reset();

    onClose();
    router.push(
      `/app/live?sessionId=${encodeURIComponent(createdSessionId)}`,
    );
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
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
        aria-label="Nueva sesión"
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: 760,
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
        <ModalHeader onClose={handleClose} disabled={submitting} />

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {/* --- Nombre --- */}
          <Field
            label="Nombre de la sesión"
            hint="Opcional — si lo dejás vacío se usa el escenario y la fecha."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                maxLength={200}
                aria-label="Nombre de la sesión"
              />
              {name.trim().length === 0 && selectedScenario ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--color-text-mid)",
                    lineHeight: 1.4,
                  }}
                  aria-live="polite"
                >
                  Se guardará como:{" "}
                  <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                    {formatAutoName(selectedScenario.label, new Date())}
                  </span>
                </p>
              ) : null}
            </div>
          </Field>

          {/* --- Escenario --- */}
          <Field
            label="Escenario"
            hint="Elegí el contexto de la conversación para que Susurra ajuste el estilo de respuesta."
          >
            <ScenarioGrid
              scenarios={scenarios}
              selectedId={scenarioId}
              onSelect={setScenarioId}
            />
          </Field>

          {/* --- Documentos relevantes --- */}
          {selectedScenario && relevantDocTypes.size > 0 ? (
            <Field
              label="Documentos relevantes"
              hint="Susurra usa estos documentos como contexto en la sesión."
            >
              <DocsSection
                docsFetched={docsFetched}
                relevantDocs={relevantDocs}
                selections={docSelections}
                onToggle={toggleDoc}
              />
            </Field>
          ) : null}

          {/* --- Persona (H3) --- */}
          <Field
            label="Persona"
            hint="Susurra usa la identidad de la persona elegida (tono, instrucciones, documentos)."
          >
            <PersonaSelector
              personas={personas}
              hasFetched={personasFetched}
              value={personaId}
              onChange={setPersonaId}
            />
          </Field>

          {/* --- Modo de Susurra --- */}
          <Field
            label="Modo de Susurra"
            hint="Cambiá cómo te acompaña Susurra durante la reunión. Una vez iniciada, no se puede cambiar."
          >
            <ModePicker value={mode} onChange={setMode} />
          </Field>

          {/* --- Material de esta reunión (H3) --- */}
          <Field
            label="Material para esta reunión (opcional)"
            hint="Texto, link o nota que sólo sirve para esta sesión."
          >
            <MaterialDraftsSection
              drafts={materialDrafts}
              onAdd={(draft) =>
                setMaterialDrafts((prev) => [...prev, draft])
              }
              onRemove={(idx) =>
                setMaterialDrafts((prev) =>
                  prev.filter((_, i) => i !== idx),
                )
              }
            />
          </Field>

          {/* --- Reunión asociada (Sprint 1 — Meet only) ---
            * Opcional. Crea un Google Meet usando el OAuth conectado, copia
            * el link al portapapeles y muestra confirmación. Sprint 1.5
            * adds: readonly URL display, Open/Copy/Invite buttons, Google-
            * connected gating, and the link-back into the session payload
            * via the `meetingId` prop. */}
          <Field
            label="Reunión asociada (opcional)"
            hint="Generá un Google Meet y copiamos el link al portapapeles."
          >
            <MeetMeetingSection
              sessionTitle={name.trim()}
              createdMeeting={createdMeeting}
              onMeetingCreated={(m) => setCreatedMeeting(m)}
            />
          </Field>

          {/* --- Idioma --- */}
          <Field
            label="Idioma"
            hint="Idioma principal de la conversación. Susurra detecta otros idiomas automáticamente."
          >
            <LanguagePicker value={language} onChange={setLanguage} />
          </Field>

          {/* --- Grabar sesión (tier-gated) --- */}
          <Field label="Grabar sesión">
            <RecordToggle
              canRecord={canRecord}
              checked={effectiveRecord}
              onChange={setRecord}
            />
          </Field>

          {error ? (
            <Card
              variant="warm"
              style={{
                color: "oklch(58% 0.22 25)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </Card>
          ) : null}
        </div>

        <footer
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <Button variant="ghost" size="md" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            trailingIcon={submitting ? undefined : <ArrowRightIcon size={16} />}
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
          >
            {submitting ? "Creando…" : "Empezar sesión"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sub-components — kept private to this file. None of them need their
// own export; they all share the modal's state via props.
// ---------------------------------------------------------------------

function ModalHeader({
  onClose,
  disabled,
}: {
  onClose: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "18px 24px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          Nueva sesión
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-mid)",
          }}
        >
          Configurá cómo querés que Susurra acompañe esta conversación.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        disabled={disabled}
        style={{
          background: "transparent",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          width: 34,
          height: 34,
          cursor: disabled ? "not-allowed" : "pointer",
          color: "var(--color-text)",
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        ×
      </button>
    </header>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          color: "var(--color-text-mid)",
        }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-mid)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ScenarioGrid({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  if (scenarios.length === 0) {
    return (
      <Card variant="soft">
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-mid)",
          }}
        >
          Cargando escenarios…
        </p>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}
      role="radiogroup"
      aria-label="Escenario de la sesión"
    >
      {scenarios.map((scenario) => {
        const color = scenarioColorOf(scenario);
        const selected = selectedId === scenario.id;
        return (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            color={color}
            selected={selected}
            onSelect={() => onSelect(scenario.id)}
          />
        );
      })}
    </div>
  );
}

function ScenarioCard({
  scenario,
  color,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  color: ScenarioColor;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const style: CSSProperties = {
    appearance: "none",
    background: selected ? COLOR_BG_SOFT[color] : "var(--color-bg-soft)",
    border: `2px solid ${selected ? COLOR_RING[color] : "var(--color-border)"}`,
    borderRadius: 16,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
    color: "var(--color-text)",
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    transition: "border-color 120ms ease, background 120ms ease",
    outline: "none",
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={style}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 9999,
            background: COLOR_BG[color],
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.2px",
            flex: 1,
          }}
        >
          {scenario.label}
        </span>
        {selected ? (
          <span
            aria-hidden
            style={{
              color: COLOR_RING[color],
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <CheckIcon size={16} />
          </span>
        ) : null}
      </div>
      {scenario.description ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-mid)",
            lineHeight: 1.4,
          }}
        >
          {scenario.description}
        </p>
      ) : null}
    </button>
  );
}

function DocsSection({
  docsFetched,
  relevantDocs,
  selections,
  onToggle,
}: {
  docsFetched: boolean;
  relevantDocs: DocumentListItem[];
  selections: Map<number, boolean>;
  onToggle: (id: number) => void;
}): JSX.Element {
  if (!docsFetched) {
    return (
      <Card variant="soft">
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-mid)",
          }}
        >
          Cargando documentos…
        </p>
      </Card>
    );
  }
  if (relevantDocs.length === 0) {
    return (
      <Card variant="soft" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text)",
            fontWeight: 600,
          }}
        >
          No tenés documentos relacionados todavía.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-mid)",
            lineHeight: 1.45,
          }}
        >
          Podés arrancar igual o subí algo desde{" "}
          <a
            href="/app/knowledge"
            style={{ color: "var(--color-text)", textDecoration: "underline" }}
          >
            /app/knowledge
          </a>
          .
        </p>
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {relevantDocs.map((doc) => {
        const t = normaliseDocType(doc.docType);
        const checked = selections.get(doc.id) === true;
        return (
          <DocRow
            key={doc.id}
            doc={doc}
            docType={t}
            checked={checked}
            onToggle={() => onToggle(doc.id)}
          />
        );
      })}
    </div>
  );
}

function DocRow({
  doc,
  docType,
  checked,
  onToggle,
}: {
  doc: DocumentListItem;
  docType: DocType;
  checked: boolean;
  onToggle: () => void;
}): JSX.Element {
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: checked ? "var(--color-bg-soft)" : "var(--color-bg)",
    border: `1px solid ${checked ? "var(--color-text-mid)" : "var(--color-border)"}`,
    borderRadius: 12,
    cursor: "pointer",
    textAlign: "left",
    appearance: "none",
    width: "100%",
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    color: "var(--color-text)",
  };
  return (
    <button type="button" onClick={onToggle} style={rowStyle} aria-pressed={checked}>
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          border: `2px solid ${checked ? "var(--color-text)" : "var(--color-border)"}`,
          background: checked ? "var(--color-text)" : "transparent",
          color: "var(--color-bg)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {checked ? <CheckIcon size={14} /> : null}
      </span>
      <span style={{ fontSize: 16 }} aria-hidden>
        {DOC_TYPE_ICONS[docType]}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {doc.title}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-mid)",
          }}
        >
          {DOC_TYPE_LABELS[docType]}
          {doc.isPrimary ? " · Principal" : ""}
        </span>
      </div>
    </button>
  );
}

function LanguagePicker({
  value,
  onChange,
}: {
  value: LangOption;
  onChange: (next: LangOption) => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
      }}
      role="radiogroup"
      aria-label="Idioma de la sesión"
    >
      {LANG_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            style={{
              appearance: "none",
              border: `2px solid ${selected ? "var(--color-text)" : "var(--color-border)"}`,
              background: selected ? "var(--color-bg-soft)" : "var(--color-bg)",
              color: "var(--color-text)",
              borderRadius: 12,
              padding: "12px 10px",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.6px",
                color: "var(--color-text-mid)",
                textTransform: "uppercase",
              }}
            >
              {opt.value}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// ModePicker — 2 radio cards for the `Session.mode` selector. Default
// "agent" preserves the pre-toggle UX. "scribe" switches the backend
// prompt builder to structured note-taking AND the /app/live HintArea
// to markdown rendering (see HintArea / HintCards / HintChat).
//
// The user CANNOT change mode mid-session (the prompt context changes
// drastically). TweaksPanel renders a read-only "Modo activo" label so
// the user remembers what they picked.
// ---------------------------------------------------------------------

interface ModeOption {
  value: SessionMode;
  icon: string;
  title: string;
  description: string;
}

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  {
    value: "agent",
    icon: "⚡", // ⚡
    title: "Agente",
    description: "Susurra genera lo que vos decís durante la reunión.",
  },
  {
    value: "scribe",
    icon: "\u{1F4DD}", // 📝
    title: "Asistente (Scribe)",
    description: "Susurra toma notas estructuradas mientras vos escuchás.",
  },
];

function ModePicker({
  value,
  onChange,
}: {
  value: SessionMode;
  onChange: (next: SessionMode) => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 10,
      }}
      role="radiogroup"
      aria-label="Modo de Susurra"
    >
      {MODE_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        const style: CSSProperties = {
          appearance: "none",
          background: selected
            ? "color-mix(in oklab, var(--color-lavender) 18%, var(--color-bg))"
            : "var(--color-bg-soft)",
          border: `2px solid ${selected ? "var(--color-lavender)" : "var(--color-border)"}`,
          borderRadius: 16,
          padding: 14,
          textAlign: "left",
          cursor: "pointer",
          color: "var(--color-text)",
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          transition: "border-color 120ms ease, background 120ms ease",
          outline: "none",
        };
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            style={style}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
                {opt.icon}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "-0.2px",
                  flex: 1,
                }}
              >
                {opt.title}
              </span>
              {selected ? (
                <span
                  aria-hidden
                  style={{
                    color: "var(--color-lavender)",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <CheckIcon size={16} />
                </span>
              ) : null}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-text-mid)",
                lineHeight: 1.4,
              }}
            >
              {opt.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function RecordToggle({
  canRecord,
  checked,
  onChange,
}: {
  canRecord: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        background: "var(--color-bg-soft)",
        border: "1px solid var(--color-border)",
        borderRadius: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: canRecord ? "var(--color-text)" : "var(--color-text-mid)",
            flexShrink: 0,
          }}
        >
          <MicIcon size={18} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            Guardar grabación
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-mid)",
            }}
          >
            Guardamos el audio para que puedas escuchar la sesión después.
          </span>
        </div>
        <Toggle
          checked={canRecord ? checked : false}
          onChange={(next) => {
            if (!canRecord) return;
            onChange(next);
          }}
          disabled={!canRecord}
          ariaLabel="Grabar la sesión"
        />
      </div>
      {!canRecord ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Pill variant="lavender" uppercase={false}>
            Disponible en Pro y Premium
          </Pill>
          <a
            href="/app/billing"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text)",
              textDecoration: "underline",
            }}
          >
            Ver planes
          </a>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// H3 — Persona selector + session materials drafts
// ---------------------------------------------------------------------

function PersonaSelector({
  personas,
  hasFetched,
  value,
  onChange,
}: {
  personas: ReadonlyArray<{
    id: number;
    name: string;
    icon: string | null;
    isDefault: boolean;
  }>;
  hasFetched: boolean;
  value: number | null;
  onChange: (next: number | null) => void;
}): JSX.Element {
  if (!hasFetched) {
    return (
      <Card variant="soft">
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-mid)",
          }}
        >
          Cargando personas…
        </p>
      </Card>
    );
  }
  if (personas.length === 0) {
    return (
      <Card variant="soft" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text)",
            fontWeight: 600,
          }}
        >
          Aún no tenés personas creadas.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-mid)",
            lineHeight: 1.45,
          }}
        >
          Definí tu persona en{" "}
          <a
            href="/app/personas"
            style={{ color: "var(--color-text)", textDecoration: "underline" }}
          >
            /app/personas
          </a>{" "}
          para personalizar la identidad de tu sesión.
        </p>
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Select
        value={value === null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
          } else {
            const parsed = Number.parseInt(raw, 10);
            onChange(Number.isFinite(parsed) ? parsed : null);
          }
        }}
        aria-label="Persona de la sesión"
      >
        <option value="">Sin persona</option>
        {personas.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {(p.icon ?? "\u{1F464}") + " " + p.name}
            {p.isDefault ? " (por defecto)" : ""}
          </option>
        ))}
      </Select>
      <a
        href="/app/personas"
        style={{
          alignSelf: "flex-start",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text)",
          textDecoration: "underline",
        }}
      >
        + Crear nueva persona
      </a>
    </div>
  );
}

const MATERIAL_TYPE_OPTIONS: ReadonlyArray<SessionMaterialType> = [
  "brief",
  "agenda",
  "objective",
  "link",
  "note",
];

function MaterialDraftsSection({
  drafts,
  onAdd,
  onRemove,
}: {
  drafts: ReadonlyArray<CreateSessionMaterialInput>;
  onAdd: (draft: CreateSessionMaterialInput) => void;
  onRemove: (index: number) => void;
}): JSX.Element {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<SessionMaterialType>("brief");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");

  const isUrlType = type === "link";

  const reset = (): void => {
    setType("brief");
    setTitle("");
    setContent("");
    setUrl("");
    setAdding(false);
  };

  const canSubmit = isUrlType
    ? url.trim().length > 0
    : content.trim().length > 0 || title.trim().length > 0;

  const handleAdd = (): void => {
    if (!canSubmit) return;
    const draft: CreateSessionMaterialInput = {
      materialType: type,
      title: title.trim().length > 0 ? title.trim() : null,
      content: !isUrlType && content.trim().length > 0 ? content.trim() : null,
      sourceUrl: isUrlType && url.trim().length > 0 ? url.trim() : null,
    };
    onAdd(draft);
    reset();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {drafts.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {drafts.map((d, idx) => (
            <li
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: "var(--color-bg-soft)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 16 }} aria-hidden>
                {SESSION_MATERIAL_TYPE_ICONS[d.materialType]}
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {d.title ??
                    d.sourceUrl ??
                    (d.content ? d.content.slice(0, 60) : "Sin título")}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-mid)",
                  }}
                >
                  {SESSION_MATERIAL_TYPE_LABELS[d.materialType]}
                  {d.content
                    ? ` · ${d.content.length} chars`
                    : d.sourceUrl
                      ? " · link"
                      : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                aria-label="Quitar material"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  color: "var(--color-text-mid)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <XIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            appearance: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "var(--color-bg)",
            border: "1px dashed var(--color-border)",
            borderRadius: 12,
            cursor: "pointer",
            color: "var(--color-text)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            alignSelf: "flex-start",
          }}
        >
          <PlusIcon size={14} />
          Agregar texto / URL / nota
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 14,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: 8,
            }}
          >
            <Select
              value={type}
              onChange={(e) =>
                setType(e.target.value as SessionMaterialType)
              }
              aria-label="Tipo de material"
            >
              {MATERIAL_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {SESSION_MATERIAL_TYPE_ICONS[opt]}{" "}
                  {SESSION_MATERIAL_TYPE_LABELS[opt]}
                </option>
              ))}
            </Select>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (opcional)"
              maxLength={140}
              aria-label="Título del material"
            />
          </div>

          {isUrlType ? (
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              aria-label="URL"
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Pegá el brief / agenda / nota aquí."
              style={{
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                background: "var(--color-bg)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: "10px 14px",
                outline: "none",
                width: "100%",
                resize: "vertical",
                minHeight: 80,
              }}
            />
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={!canSubmit}
            >
              Agregar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// MeetMeetingSection — optional "Crear reunión de Meet" button.
//
// Sprint 1 (legacy):
//   - One button.
//   - On success: copies `join_url` + green confirmation badge.
//   - On error: contextual Spanish for 412 (not connected) / 401 (refresh
//     failed), or the raw message for anything else.
//
// Sprint 1.5 additions:
//   - Disable the create button when Google is NOT connected (via
//     `useIntegrations()`). Show an inline message pointing to
//     `/app/settings#reuniones`.
//   - After successful creation, display the FULL URL in a readonly text
//     field + 3 action buttons (Abrir en Meet / Copiar link / Invitar por
//     email).
//   - Lift the created meeting id up to the modal via `onMeetingCreated`
//     so the session create payload can carry the `meetingId` FK.
//   - Small info line about expiration + tab-share.
//
// This section is COMPLETELY independent of session creation — the user
// can still create the session without ever clicking the button.
// ---------------------------------------------------------------------

function MeetMeetingSection({
  sessionTitle,
  createdMeeting,
  onMeetingCreated,
}: {
  sessionTitle: string;
  createdMeeting: { id: string; joinUrl: string } | null;
  onMeetingCreated: (meeting: { id: string; joinUrl: string }) => void;
}): JSX.Element {
  const { createMeeting, loading } = useMeet();
  const { integrations, hasFetched: integrationsFetched } = useIntegrations();
  const googleConnected = integrations.some((i) => i.provider === "google");
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (): Promise<void> => {
    setLocalError(null);
    try {
      const title = sessionTitle.length > 0 ? sessionTitle : undefined;
      const meeting = await createMeeting(title);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(meeting.joinUrl);
        }
      } catch {
        // Clipboard write can fail in non-secure contexts.
      }
      onMeetingCreated({ id: meeting.id, joinUrl: meeting.joinUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // FetchApiClient surfaces "API 412 /path: detail" — pattern-match
      // the status code from there.
      if (/\bAPI 412\b/.test(msg)) {
        setLocalError(
          "Conectá tu cuenta Google en Configuración → Reuniones primero.",
        );
      } else if (/\bAPI 401\b/.test(msg)) {
        setLocalError("Tu sesión Google expiró. Reconectá tu cuenta.");
      } else if (/\bAPI 502\b/.test(msg)) {
        setLocalError(
          "Google Meet no pudo crear la reunión. Probá de nuevo en un rato.",
        );
      } else {
        setLocalError(msg);
      }
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!createdMeeting) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(createdMeeting.joinUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Silent — URL is visible in the readonly input.
    }
  };

  const handleOpen = (): void => {
    if (typeof window === "undefined" || !createdMeeting) return;
    window.open(createdMeeting.joinUrl, "_blank", "noopener,noreferrer");
  };

  const handleInvite = (): void => {
    if (typeof window === "undefined" || !createdMeeting) return;
    const subject = encodeURIComponent("Invitación a reunión");
    const body = encodeURIComponent(
      `Te invito a una reunión: ${createdMeeting.joinUrl}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Gating: we wait for the integrations list to settle before deciding —
  // otherwise the button briefly flickers from disabled to enabled on
  // mount. While `integrationsFetched` is false, we render the button
  // enabled-but-checking-state (loading prop already covers that path).
  const createDisabled = loading || (integrationsFetched && !googleConnected);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {createdMeeting ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 12,
            background: "var(--color-bg-soft)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--color-text-mid)",
            }}
          >
            Link de la reunión
          </span>
          <Input
            value={createdMeeting.joinUrl}
            readOnly
            aria-label="URL de la reunión creada"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Button variant="primary" size="sm" onClick={handleOpen}>
              Abrir en Meet
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleCopy();
              }}
            >
              {copied ? "¡Copiado!" : "Copiar link"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleInvite}>
              Invitar por email
            </Button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--color-text-mid)",
              lineHeight: 1.4,
            }}
          >
            El link expira si nadie se une por 1 hora. Susurra escucha vía
            tab-share una vez que abras la reunión.
          </p>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void handleCreate();
          }}
          disabled={createDisabled}
          style={{ alignSelf: "flex-start" }}
        >
          {loading ? "Creando reunión…" : "Crear reunión de Meet"}
        </Button>
      )}

      {!createdMeeting && integrationsFetched && !googleConnected ? (
        <Card
          variant="warm"
          style={{
            color: "var(--color-text)",
            fontSize: 13,
            fontWeight: 500,
            padding: "10px 12px",
          }}
        >
          Conectá tu cuenta Google en{" "}
          <a
            href="/app/settings#reuniones"
            style={{
              color: "var(--color-coral, oklch(70% 0.18 25))",
              textDecoration: "underline",
            }}
          >
            Configuración → Reuniones
          </a>{" "}
          para poder crear reuniones.
        </Card>
      ) : null}

      {localError ? (
        <Card
          variant="warm"
          style={{
            color: "oklch(58% 0.22 25)",
            fontSize: 13,
            fontWeight: 500,
            padding: "10px 12px",
          }}
        >
          {localError}
          {localError.startsWith("Conectá tu cuenta Google") ? (
            <>
              {" "}
              <a
                href="/app/settings#reuniones"
                style={{
                  color: "var(--color-coral, oklch(70% 0.18 25))",
                  textDecoration: "underline",
                }}
              >
                Ir a Configuración
              </a>
            </>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

