"use client";

/**
 * Step 2 — Upload CV. Reuses F3's `<DocumentUploader>` for full feature
 * parity (file/url/text + scope picker + validation). When the upload
 * succeeds we auto-advance to step 3; the user can also click "Continuar"
 * (enabled once a CV exists in the store) or skip this step entirely.
 *
 * Reading `useDocuments().hasCv` lets us reflect a previously-uploaded CV
 * (e.g. user navigated away and came back) so the user is not forced to
 * upload a second time.
 */

import { useCallback, type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import { DocumentUploader } from "@/presentation/components/knowledge/DocumentUploader";
import { useDocuments } from "@/presentation/hooks/use-documents";
import { useScenarios } from "@/presentation/hooks/use-scenarios";

interface Step2UploadCVProps {
  onNext: () => void;
  onSkip: () => void;
}

export function Step2UploadCV({
  onNext,
  onSkip,
}: Step2UploadCVProps): JSX.Element {
  const { hasCv, refresh } = useDocuments();
  const { current: currentScenarioId, available } = useScenarios();
  const currentScenario = available.find((s) => s.id === currentScenarioId);

  const handleUploaded = useCallback((): void => {
    void refresh();
    // Auto-advance once the upload succeeds.
    onNext();
  }, [refresh, onNext]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Card padded variant="soft" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
          Susurra usa tu CV para responder en tu nombre con tu experiencia
          real, no con genérico. Aceptamos PDF, DOCX, Markdown o texto
          pegado. Podés saltarlo y subirlo más tarde desde Knowledge.
        </p>
      </Card>

      <DocumentUploader
        currentScenarioId={currentScenarioId}
        currentScenarioLabel={currentScenario?.label ?? null}
        onUploaded={handleUploaded}
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <Button variant="ghost" size="md" onClick={onSkip}>
          Saltar este paso
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={!hasCv}
          onClick={onNext}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
