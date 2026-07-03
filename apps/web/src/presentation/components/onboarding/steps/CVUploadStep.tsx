"use client";

/**
 * CVUploadStep — Step 2/5. Reuses `<DocumentUploader>` so the full
 * file/url/text uploader (with scope picker) is available without
 * rebuilding it.
 *
 * Lifecycle:
 *   - On upload success the uploader calls `onUploaded` → we refresh the
 *     documents store and report the new cvDocumentId up to the wizard.
 *   - The "Continuar" CTA stays disabled until there's at least one CV
 *     document. The user can also click "Saltar este paso" to proceed
 *     without uploading (the wizard then defaults the next step's persona
 *     to "Mi perfil principal" with no doc linkage).
 *
 * No CV warning copy explains the implication of skipping so the user
 * makes an informed choice — not a guess.
 */

import { useCallback, useEffect, useMemo, type JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import { DocumentUploader } from "@/presentation/components/knowledge/DocumentUploader";
import { useDocuments } from "@/presentation/hooks/use-documents";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { WizardNav } from "../WizardNav";

interface CVUploadStepProps {
  onNext: (cvDocumentId: number | null) => void;
  onBack: () => void;
  onSkipStep: () => void;
}

export function CVUploadStep({
  onNext,
  onBack,
  onSkipStep,
}: CVUploadStepProps): JSX.Element {
  const { documents, hasCv, refresh } = useDocuments();
  const { current: currentScenarioId, available } = useScenarios();
  const currentScenario = available.find((s) => s.id === currentScenarioId);

  // The most-recently-uploaded CV id is what we hand up to the wizard so
  // the persona step can link it as identity. `documents` is ordered by
  // uploaded_at DESC in the store, so the first CV match is the freshest.
  const latestCvId = useMemo<number | null>(() => {
    const cv = documents.find((d) => d.docType === "cv");
    return cv ? cv.id : null;
  }, [documents]);

  const handleUploaded = useCallback((): void => {
    void refresh();
  }, [refresh]);

  // Best-effort initial sync — if the user navigated away and came back,
  // the store may be cold. The hook itself already self-refreshes on
  // mount, but the call here is harmless thanks to the stale-window dedup.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        padded
        variant="soft"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <Pill variant="lavender">Paso 2</Pill>
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.6px",
          }}
        >
          Subí tu CV
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            lineHeight: 1.55,
          }}
        >
          Susurra usa tu CV para responder con tu experiencia real, no con
          plantillas genéricas. Aceptamos PDF, DOCX, Markdown o texto
          pegado. Podés saltarlo, pero las sugerencias pierden filo sin él.
        </p>
      </Card>

      <DocumentUploader
        currentScenarioId={currentScenarioId}
        currentScenarioLabel={currentScenario?.label ?? null}
        onUploaded={handleUploaded}
      />

      {!hasCv ? (
        <div
          role="note"
          style={{
            background: "var(--color-bg-soft)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            padding: "10px 14px",
            color: "var(--color-text-mid)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Sin CV, Susurra sugiere respuestas genéricas. Podés sumarlo más
          tarde desde <strong>/app/knowledge</strong> sin perder lo que
          configuraste acá.
        </div>
      ) : null}

      <WizardNav
        onBack={onBack}
        onSkipStep={onSkipStep}
        onNext={() => onNext(latestCvId)}
        nextDisabled={!hasCv}
        nextLabel="Continuar"
      />
    </div>
  );
}
