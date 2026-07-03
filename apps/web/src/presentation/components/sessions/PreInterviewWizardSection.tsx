"use client";

/**
 * PreInterviewWizardSection — optional AI-prep step inside NewSessionModal.
 *
 * Only mounted for interview_dev / interview_behavioral scenarios. Three
 * UI states share the same component:
 *   1. Collapsed (default)  — explainer + "Configurar preparación" CTA.
 *   2. Expanded form        — role / company / JD / raw context inputs +
 *                             "Generar preparación" CTA.
 *   3. Generated preview    — two lists (probing_questions in English,
 *                             prep_checklist in es-LATAM). Buttons:
 *                             "Regenerar" + "Guardar y continuar".
 *
 * The parent (NewSessionModal) owns the `prepData` state. This component
 * is purely a controlled view: it lifts the generated arrays + form
 * inputs up via `onChange` once "Guardar y continuar" is clicked. The
 * actual persistence (POST /api/pre-meeting-notes) happens AFTER the
 * session is created — the modal threads the saved arrays into the
 * createPreMeetingNote use case once `createSession` succeeds.
 *
 * Brand voice: silencioso, atento, preciso. es-LATAM voseo. No emojis.
 */

import { useState } from "react";
import type { CSSProperties, JSX } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  easeOutQuart,
  fadeUpSubtle,
  staggerContainer,
} from "@/lib/motion-presets";
import { Button, Card, Input, Spinner } from "@/design-system/primitives";
import { useContainer } from "@/infrastructure/di/container";

export interface PreInterviewWizardData {
  roleTarget: string;
  companyContext: string;
  jobDescription: string;
  rawUserInput: string;
  probingQuestions: readonly string[];
  prepChecklist: readonly string[];
}

interface PreInterviewWizardSectionProps {
  scenarioId: string;
  personaId: number | null;
  onSaved: (data: PreInterviewWizardData | null) => void;
}

type WizardStage = "collapsed" | "form" | "preview";

export function PreInterviewWizardSection({
  scenarioId,
  personaId,
  onSaved,
}: PreInterviewWizardSectionProps): JSX.Element {
  const { generatePreMeetingNote } = useContainer();
  const shouldReduceMotion = useReducedMotion();

  const [stage, setStage] = useState<WizardStage>("collapsed");
  const [roleTarget, setRoleTarget] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [rawUserInput, setRawUserInput] = useState("");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [probingQuestions, setProbingQuestions] = useState<readonly string[]>(
    [],
  );
  const [prepChecklist, setPrepChecklist] = useState<readonly string[]>([]);
  const [saved, setSaved] = useState(false);

  const canGenerate =
    rawUserInput.trim().length > 0 &&
    roleTarget.trim().length > 0 &&
    companyContext.trim().length > 0 &&
    !generating;

  const handleGenerate = async (): Promise<void> => {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generatePreMeetingNote.execute({
        scenarioId,
        personaId,
        roleTarget: roleTarget.trim(),
        companyContext: companyContext.trim(),
        jobDescription: jobDescription.trim() || null,
        rawUserInput: rawUserInput.trim(),
      });
      const questions = [...result.probingQuestions];
      const checklist = [...result.prepChecklist];
      if (questions.length === 0 && checklist.length === 0) {
        setError(
          "No pudimos generar. Probá de nuevo en un momento o ajustá el contexto.",
        );
        setGenerating(false);
        return;
      }
      setProbingQuestions(questions);
      setPrepChecklist(checklist);
      setStage("preview");
      setSaved(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("502") || msg.includes("500")
          ? "No pudimos generar. Probá de nuevo en un momento."
          : msg,
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = (): void => {
    onSaved({
      roleTarget: roleTarget.trim(),
      companyContext: companyContext.trim(),
      jobDescription: jobDescription.trim(),
      rawUserInput: rawUserInput.trim(),
      probingQuestions,
      prepChecklist,
    });
    setSaved(true);
  };

  const handleDiscard = (): void => {
    onSaved(null);
    setStage("collapsed");
    setSaved(false);
    setProbingQuestions([]);
    setPrepChecklist([]);
    setError(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <AnimatePresence initial={false} mode="wait">
        {stage === "collapsed" ? (
          <motion.div
            key="collapsed"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: easeOutQuart }}
          >
            <CollapsedCard onExpand={() => setStage("form")} />
          </motion.div>
        ) : null}

        {stage === "form" ? (
          <motion.div
            key="form"
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: easeOutQuart }}
            style={{ overflow: "hidden" }}
          >
            <FormCard
              roleTarget={roleTarget}
              companyContext={companyContext}
              jobDescription={jobDescription}
              rawUserInput={rawUserInput}
              onRoleTargetChange={setRoleTarget}
              onCompanyContextChange={setCompanyContext}
              onJobDescriptionChange={setJobDescription}
              onRawUserInputChange={setRawUserInput}
              onCancel={() => {
                setStage("collapsed");
                setError(null);
              }}
              onGenerate={() => {
                void handleGenerate();
              }}
              canGenerate={canGenerate}
              generating={generating}
              error={error}
            />
          </motion.div>
        ) : null}

        {stage === "preview" ? (
          <motion.div
            key="preview"
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: easeOutQuart }}
            style={{ overflow: "hidden" }}
          >
            <PreviewCard
              probingQuestions={probingQuestions}
              prepChecklist={prepChecklist}
              saved={saved}
              regenerating={generating}
              onRegenerate={() => {
                void handleGenerate();
              }}
              onBackToForm={() => {
                setStage("form");
                setSaved(false);
              }}
              onSave={handleSave}
              onDiscard={handleDiscard}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------

function CollapsedCard({ onExpand }: { onExpand: () => void }): JSX.Element {
  return (
    <Card
      variant="soft"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 14,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.2px",
            color: "var(--color-text)",
          }}
        >
          Preparación con IA (opcional)
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          Contanos sobre la entrevista y Susurra te genera preguntas probables
          y un checklist para repasar antes.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onExpand}
        style={{ alignSelf: "flex-start" }}
      >
        Configurar preparación
      </Button>
    </Card>
  );
}

function FormCard({
  roleTarget,
  companyContext,
  jobDescription,
  rawUserInput,
  onRoleTargetChange,
  onCompanyContextChange,
  onJobDescriptionChange,
  onRawUserInputChange,
  onCancel,
  onGenerate,
  canGenerate,
  generating,
  error,
}: {
  roleTarget: string;
  companyContext: string;
  jobDescription: string;
  rawUserInput: string;
  onRoleTargetChange: (next: string) => void;
  onCompanyContextChange: (next: string) => void;
  onJobDescriptionChange: (next: string) => void;
  onRawUserInputChange: (next: string) => void;
  onCancel: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
  generating: boolean;
  error: string | null;
}): JSX.Element {
  return (
    <Card
      variant="soft"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 14,
        borderRadius: 14,
      }}
    >
      <FieldGroup
        label="Contanos sobre la entrevista"
        hint="Cuanto más contexto, mejores son las preguntas y el checklist."
      >
        <textarea
          value={rawUserInput}
          onChange={(e) => onRawUserInputChange(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Tengo entrevista mañana con Stripe para un rol Senior Backend. Stack: Go, Postgres, gRPC. Es la 2da ronda — system design + behavioural."
          aria-label="Contexto de la entrevista"
          style={textareaStyle}
        />
      </FieldGroup>

      <div style={twoColGrid}>
        <FieldGroup label="Rol objetivo">
          <Input
            value={roleTarget}
            onChange={(e) => onRoleTargetChange(e.target.value)}
            placeholder="Senior Backend Engineer"
            maxLength={300}
            aria-label="Rol objetivo"
          />
        </FieldGroup>
        <FieldGroup label="Empresa / contexto">
          <Input
            value={companyContext}
            onChange={(e) => onCompanyContextChange(e.target.value)}
            placeholder="Stripe, fintech, Series F"
            maxLength={500}
            aria-label="Empresa o contexto"
          />
        </FieldGroup>
      </div>

      <FieldGroup
        label="Job description (opcional)"
        hint="Pegá el JD si lo tenés a mano."
      >
        <textarea
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          rows={3}
          maxLength={8000}
          placeholder="Pegá acá el job description para que la preparación sea más específica."
          aria-label="Job description"
          style={textareaStyle}
        />
      </FieldGroup>

      {error ? (
        <div
          role="alert"
          style={{
            fontSize: 12.5,
            color: "var(--color-danger)",
            fontWeight: 500,
            background:
              "color-mix(in oklab, var(--color-danger) 8%, var(--color-bg))",
            border:
              "1px solid color-mix(in oklab, var(--color-danger) 30%, var(--color-border))",
            borderRadius: 10,
            padding: "8px 12px",
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={generating}
        >
          Cancelar
        </Button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {generating ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--color-text-mid)",
              }}
            >
              <Spinner size={14} />
              Generando con IA…
            </span>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            onClick={onGenerate}
            disabled={!canGenerate}
          >
            {generating ? "Generando…" : "Generar preparación"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PreviewCard({
  probingQuestions,
  prepChecklist,
  saved,
  regenerating,
  onRegenerate,
  onBackToForm,
  onSave,
  onDiscard,
}: {
  probingQuestions: readonly string[];
  prepChecklist: readonly string[];
  saved: boolean;
  regenerating: boolean;
  onRegenerate: () => void;
  onBackToForm: () => void;
  onSave: () => void;
  onDiscard: () => void;
}): JSX.Element {
  return (
    <motion.div
      variants={staggerContainer(0, 0.05)}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <motion.div variants={fadeUpSubtle}>
        <PreviewListCard
          title="Preguntas probables"
          subtitle="EN INGLÉS · likely interview questions"
          items={probingQuestions}
          emptyHint="La IA no devolvió preguntas. Probá regenerar."
          mono
        />
      </motion.div>

      <motion.div variants={fadeUpSubtle}>
        <PreviewListCard
          title="Checklist para repasar"
          subtitle="es-LATAM · cosas concretas antes de la llamada"
          items={prepChecklist}
          emptyHint="La IA no devolvió checklist. Probá regenerar."
          mono={false}
        />
      </motion.div>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToForm}
            disabled={regenerating}
          >
            Editar contexto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? "Regenerando…" : "Regenerar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={regenerating}
          >
            Descartar
          </Button>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={regenerating}
        >
          {saved ? "Guardado · podés seguir" : "Guardar y continuar"}
        </Button>
      </div>
    </motion.div>
  );
}

function PreviewListCard({
  title,
  subtitle,
  items,
  emptyHint,
  mono,
}: {
  title: string;
  subtitle: string;
  items: readonly string[];
  emptyHint: string;
  mono: boolean;
}): JSX.Element {
  return (
    <Card
      variant="soft"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.2px",
            color: "var(--color-text)",
          }}
        >
          {title}
        </h4>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--color-text-mid)",
          }}
        >
          {subtitle}
        </span>
      </div>
      {items.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          {emptyHint}
        </p>
      ) : (
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {items.map((item, idx) => (
            <li
              key={`${idx}-${item.slice(0, 20)}`}
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--color-text)",
                fontFamily: mono ? "var(--font-mono)" : "var(--font-inter)",
                fontWeight: mono ? 500 : 400,
              }}
            >
              {item}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
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
            fontSize: 11.5,
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

const textareaStyle: CSSProperties = {
  fontFamily: "var(--font-inter)",
  fontSize: 13.5,
  fontWeight: 500,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  padding: "10px 12px",
  outline: "none",
  width: "100%",
  resize: "vertical",
  minHeight: 72,
  lineHeight: 1.5,
};

const twoColGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};
