"use client";

/**
 * DocumentList — groups KB documents into sections by type-and-scope.
 *
 * Sections:
 *   1. "Globales (todos los escenarios)": cv, profile, reference where
 *      scenario === null.
 *   2. "Específicos para {scenarioName}": scenario-scoped types matching
 *      the current scenario.
 *   3. "Otros escenarios": docs from other scenarios — collapsed by
 *      default to keep the page tidy.
 *
 * Empty states are first-class UX (FR-4): if the user has no CV the page
 * shows a CTA pointing at the uploader.
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { Spinner, Pill } from "@/design-system/primitives";
import {
  DOC_TYPE_LABELS,
  GLOBAL_DOC_TYPES,
  SCENARIO_SCOPED_DOC_TYPES,
  type DocType,
  type DocumentListItem,
} from "@/domain/entities/document";
import { DocumentCard } from "./DocumentCard";

interface ScenarioOption {
  id: string;
  label: string;
}

interface DocumentListProps {
  documents: DocumentListItem[];
  loading: boolean;
  hasFetched: boolean;
  currentScenarioId: string | null;
  scenarios: ScenarioOption[];
  onView: (doc: DocumentListItem) => void;
  onEdit: (doc: DocumentListItem) => void;
  onDelete: (doc: DocumentListItem) => void;
  onTogglePrimary?: (doc: DocumentListItem, next: boolean) => void;
  onScrollToUploader?: () => void;
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
  color: "var(--color-text-mid)",
  margin: 0,
  fontFamily: "var(--font-jet-brains-mono), ui-monospace, monospace",
};

export function DocumentList({
  documents,
  loading,
  hasFetched,
  currentScenarioId,
  scenarios,
  onView,
  onEdit,
  onDelete,
  onTogglePrimary,
  onScrollToUploader,
}: DocumentListProps): JSX.Element {
  const [showOtherScenarios, setShowOtherScenarios] = useState(false);

  const scenarioLabel = useMemo<string | null>(() => {
    if (!currentScenarioId) return null;
    return (
      scenarios.find((s) => s.id === currentScenarioId)?.label ??
      currentScenarioId
    );
  }, [currentScenarioId, scenarios]);

  const labelOf = (id: string | null): string | null => {
    if (!id) return null;
    return scenarios.find((s) => s.id === id)?.label ?? id;
  };

  const groups = useMemo(() => {
    const globals: DocumentListItem[] = [];
    const currentScenario: DocumentListItem[] = [];
    const otherScenarios: DocumentListItem[] = [];

    for (const d of documents) {
      const isGlobalType = (GLOBAL_DOC_TYPES as readonly DocType[]).includes(
        d.docType,
      );

      if (d.scenario == null) {
        // Global by data — every type that's null-scenario goes here.
        if (isGlobalType || d.docType === "other") {
          globals.push(d);
        } else {
          // Scenario-scoped type stored as global is unusual but valid;
          // surface in globals so user can find it.
          globals.push(d);
        }
      } else if (d.scenario === currentScenarioId) {
        currentScenario.push(d);
      } else {
        otherScenarios.push(d);
      }
    }

    return { globals, currentScenario, otherScenarios };
  }, [documents, currentScenarioId]);

  if (!hasFetched && loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Spinner size={18} />
        <span style={{ color: "var(--color-text-mid)", fontSize: 14 }}>
          Cargando tu base de conocimiento…
        </span>
      </div>
    );
  }

  if (hasFetched && documents.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          borderRadius: 22,
          border: "1px dashed var(--color-border)",
          textAlign: "center",
          background: "var(--color-bg-soft)",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.4px",
          }}
        >
          Aún no hay documentos en tu base de conocimiento
        </h3>
        <p
          style={{
            margin: "0 0 18px",
            color: "var(--color-text-mid)",
            fontSize: 14,
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Subí tu CV, una oferta de trabajo o cualquier material de
          referencia para que Auri te ayude mejor en tus sesiones en vivo.
        </p>
        {onScrollToUploader ? (
          <button
            type="button"
            onClick={onScrollToUploader}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid var(--color-text)",
              background: "var(--color-text)",
              color: "var(--color-bg)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Empezá ahora
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Section
        title="Globales (todos los escenarios)"
        hint="Aplican a todas tus sesiones."
        scenarioLabel={null}
        scenarios={scenarios}
        labelOf={labelOf}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePrimary={onTogglePrimary}
        docs={groups.globals}
        emptyHint="Subí al menos tu CV para que Auri lo use de contexto."
      />
      <Section
        title={
          scenarioLabel
            ? `Específicos para ${scenarioLabel}`
            : "Específicos del escenario actual"
        }
        hint="Solo aplican al escenario activo en la barra superior."
        scenarioLabel={scenarioLabel}
        scenarios={scenarios}
        labelOf={labelOf}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePrimary={onTogglePrimary}
        docs={groups.currentScenario}
        emptyHint={
          currentScenarioId
            ? `Sumá una ${formatTypeList(SCENARIO_SCOPED_DOC_TYPES)} para este escenario.`
            : "Elegí un escenario en la barra superior para verlos."
        }
      />
      {groups.otherScenarios.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowOtherScenarios((v) => !v)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Pill variant="ghost">
              {showOtherScenarios ? "Ocultar" : "Mostrar"} otros escenarios (
              {groups.otherScenarios.length})
            </Pill>
          </button>
          {showOtherScenarios ? (
            <div style={{ marginTop: 12 }}>
              <Section
                title="Otros escenarios"
                hint="Documentos atados a otros escenarios."
                scenarioLabel={null}
                scenarios={scenarios}
                labelOf={labelOf}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onTogglePrimary={onTogglePrimary}
                docs={groups.otherScenarios}
                emptyHint=""
                hideHeader
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SectionProps {
  title: string;
  hint: string;
  scenarioLabel: string | null;
  scenarios: ScenarioOption[];
  labelOf: (id: string | null) => string | null;
  onView: (doc: DocumentListItem) => void;
  onEdit: (doc: DocumentListItem) => void;
  onDelete: (doc: DocumentListItem) => void;
  onTogglePrimary?: (doc: DocumentListItem, next: boolean) => void;
  docs: DocumentListItem[];
  emptyHint: string;
  hideHeader?: boolean;
}

function Section({
  title,
  hint,
  labelOf,
  onView,
  onEdit,
  onDelete,
  onTogglePrimary,
  docs,
  emptyHint,
  hideHeader,
}: SectionProps): JSX.Element {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {hideHeader ? null : (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <h3 style={sectionTitleStyle}>{title}</h3>
          <span style={{ fontSize: 12, color: "var(--color-text-mid)" }}>
            {hint}
          </span>
        </div>
      )}
      {docs.length === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            border: "1px dashed var(--color-border)",
            borderRadius: 16,
            color: "var(--color-text-mid)",
            fontSize: 13,
            textAlign: "left",
          }}
        >
          {emptyHint}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => {
            const cardProps = {
              doc: d,
              scenarioLabel: labelOf(d.scenario),
              onView: () => onView(d),
              onEdit: () => onEdit(d),
              onDelete: () => onDelete(d),
              ...(onTogglePrimary
                ? { onTogglePrimary: (next: boolean) => onTogglePrimary(d, next) }
                : {}),
            };
            return <DocumentCard key={d.id} {...cardProps} />;
          })}
        </div>
      )}
    </section>
  );
}

function formatTypeList(types: readonly DocType[]): string {
  if (types.length === 0) return "documento";
  const labels = types.map((t) => DOC_TYPE_LABELS[t].toLowerCase());
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(", ")} o ${labels[labels.length - 1]}`;
}
