"use client";

/**
 * Onboarding page (/app/onboarding) — F9 implementation.
 *
 * Stateful 3-step flow:
 *   1. Welcome (auto-advance via "Empezar")
 *   2. Upload CV (auto-advance on success or skip)
 *   3. First session (CTA → /app/live)
 *
 * The page does NOT redirect first-time users itself — that's the
 * `(app)/layout.tsx` redirect's job (it runs on every protected route).
 * On step completion / skip we always call `markCompleted()` so the
 * localStorage flag flips and the redirect won't fire again.
 *
 * Analytics: each step transition emits an `onboarding_step` event with
 * the action (`completed` or `skipped`) so we can measure funnel drop-off.
 */

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useAnalytics } from "@/presentation/hooks/use-analytics";
import { useOnboardingStatus } from "@/presentation/hooks/use-onboarding-status";
import { OnboardingShell } from "@/presentation/components/onboarding/OnboardingShell";
import { Step1Welcome } from "@/presentation/components/onboarding/Step1Welcome";
import { Step2UploadCV } from "@/presentation/components/onboarding/Step2UploadCV";
import { Step3FirstSession } from "@/presentation/components/onboarding/Step3FirstSession";

export default function OnboardingPage(): JSX.Element {
  const router = useRouter();
  const { track } = useAnalytics();
  const { markCompleted } = useOnboardingStatus();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const goNext = (): void => {
    track({ name: "onboarding_step", step, action: "completed" });
    if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3);
    }
  };

  const skip = (): void => {
    track({ name: "onboarding_step", step, action: "skipped" });
    markCompleted();
    router.replace("/app");
  };

  const skipStep = (): void => {
    track({ name: "onboarding_step", step, action: "skipped" });
    setStep((step + 1) as 1 | 2 | 3);
  };

  const finish = (): void => {
    track({ name: "onboarding_step", step: 3, action: "completed" });
    markCompleted();
    router.replace("/app/live");
  };

  return (
    <OnboardingShell currentStep={step} totalSteps={3} onSkip={skip}>
      {step === 1 ? <Step1Welcome onNext={goNext} /> : null}
      {step === 2 ? (
        <Step2UploadCV onNext={goNext} onSkip={skipStep} />
      ) : null}
      {step === 3 ? <Step3FirstSession onFinish={finish} /> : null}
    </OnboardingShell>
  );
}
