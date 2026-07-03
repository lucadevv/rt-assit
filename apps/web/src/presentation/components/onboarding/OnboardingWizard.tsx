"use client";

/**
 * OnboardingWizard — first-run wizard (5 steps) for beta users.
 *
 * Owns:
 *  - Current step index (1..5).
 *  - Accumulated wizard data: cvDocumentId, defaultScenarioId, firstPersonaId.
 *  - Forward/back navigation with animated transitions.
 *  - The final `markCompleted()` call + redirect to /app.
 *
 * Skipped state: clicking "Cancelar y configurar después" (top-right exit
 * in the OnboardingShell) does NOT mark onboarding complete — the user
 * will see the wizard again on next mount. That's intentional: skipping
 * the WHOLE wizard mid-step shouldn't permanently dismiss it.
 *
 * Refresh mid-wizard: state is lost (we restart from step 1). Acceptable
 * for v1 — the wizard is short and idempotent.
 *
 * Edge cases handled:
 *  - Backend down during finish → markCompleted swallows the error and
 *    flips the local flag so the user isn't trapped; next preferences
 *    fetch reconciles.
 *  - User has existing CV/persona (returning user, onboarding_complete=
 *    false somehow) → wizard still runs, but the steps degrade gracefully
 *    (CV step shows existing CVs, persona step still creates a fresh one).
 */

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useAnalytics } from "@/presentation/hooks/use-analytics";
import { useOnboardingStatus } from "@/presentation/hooks/use-onboarding-status";
import { easeOut } from "@/lib/motion-presets";
import { OnboardingShell } from "./OnboardingShell";
import { StepProgress } from "./StepProgress";
import { WelcomeStep } from "./steps/WelcomeStep";
import { CVUploadStep } from "./steps/CVUploadStep";
import { ScenarioStep } from "./steps/ScenarioStep";
import { PersonaStep } from "./steps/PersonaStep";
import { TutorialStep } from "./steps/TutorialStep";

const TOTAL_STEPS = 5;
type StepIndex = 1 | 2 | 3 | 4 | 5;

interface OnboardingData {
  cvDocumentId: number | null;
  defaultScenarioId: string | null;
  firstPersonaId: number | null;
}

export function OnboardingWizard(): JSX.Element {
  const router = useRouter();
  const { track } = useAnalytics();
  const { markCompleted } = useOnboardingStatus();
  const shouldReduceMotion = useReducedMotion();

  const [step, setStep] = useState<StepIndex>(1);
  const [data, setData] = useState<OnboardingData>({
    cvDocumentId: null,
    defaultScenarioId: null,
    firstPersonaId: null,
  });
  const [finishing, setFinishing] = useState(false);

  // ----- step transitions -----

  const goNext = (next: StepIndex): void => {
    track({ name: "onboarding_step", step, action: "completed" });
    setStep(next);
  };

  const goBack = (prev: StepIndex): void => {
    track({ name: "onboarding_step", step, action: "back" });
    setStep(prev);
  };

  // Top-right "Cancelar y configurar después" — exits without marking
  // complete, so the wizard fires again on next mount.
  const cancel = (): void => {
    track({ name: "onboarding_step", step, action: "cancelled" });
    router.replace("/app");
  };

  // Step 2 skip — the user explicitly chooses to skip CV upload, but
  // continues the wizard. We DON'T mark complete; we just advance.
  const skipCv = (): void => {
    track({ name: "onboarding_step", step: 2, action: "skipped" });
    setData((prev) => ({ ...prev, cvDocumentId: null }));
    setStep(3);
  };

  // Step 5 — final commit. Flips onboarding_complete and redirects.
  const finish = async (): Promise<void> => {
    setFinishing(true);
    track({ name: "onboarding_step", step: 5, action: "completed" });
    try {
      await markCompleted();
    } catch (err) {
      // markCompleted already swallows the error and flips local state,
      // so we always continue to /app. This catch is just defensive.
      // eslint-disable-next-line no-console -- dev signal only
      console.warn("[susurra] markCompleted threw unexpectedly:", err);
    } finally {
      setFinishing(false);
      router.replace("/app");
    }
  };

  // ----- per-step renderers -----

  const renderStep = (): JSX.Element => {
    switch (step) {
      case 1:
        return <WelcomeStep onNext={() => goNext(2)} />;
      case 2:
        return (
          <CVUploadStep
            onBack={() => goBack(1)}
            onSkipStep={skipCv}
            onNext={(cvDocumentId) => {
              setData((prev) => ({ ...prev, cvDocumentId }));
              goNext(3);
            }}
          />
        );
      case 3:
        return (
          <ScenarioStep
            initialScenarioId={data.defaultScenarioId}
            onBack={() => goBack(2)}
            onNext={(scenarioId) => {
              setData((prev) => ({
                ...prev,
                defaultScenarioId: scenarioId,
              }));
              goNext(4);
            }}
          />
        );
      case 4:
        return (
          <PersonaStep
            cvDocumentId={data.cvDocumentId}
            scenarioId={data.defaultScenarioId}
            initialPersonaId={data.firstPersonaId}
            onBack={() => goBack(3)}
            onNext={(personaId) => {
              setData((prev) => ({ ...prev, firstPersonaId: personaId }));
              goNext(5);
            }}
          />
        );
      case 5:
        return (
          <TutorialStep
            onBack={() => goBack(4)}
            onFinish={finish}
            finishing={finishing}
          />
        );
      default:
        return <WelcomeStep onNext={() => goNext(2)} />;
    }
  };

  return (
    <OnboardingShell
      currentStep={step}
      totalSteps={TOTAL_STEPS}
      onSkip={cancel}
    >
      <StepProgress current={step} total={TOTAL_STEPS} />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.24, ease: easeOut }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </OnboardingShell>
  );
}
