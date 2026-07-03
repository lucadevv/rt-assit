"use client";

/**
 * Onboarding page (/app/onboarding) — beta launch wizard.
 *
 * The route is intentionally thin: the heavy lifting (step state, wizard
 * data accumulator, navigation, final commit + redirect) lives in
 * `<OnboardingWizard>` so the page itself can stay as the route entry
 * for Next.js without bloating with logic.
 *
 * Redirect rules: this page does NOT redirect first-time users — that's
 * the job of `(app)/layout.tsx`, which reads `useOnboardingStatus` on
 * every protected route and bounces here when `onboarding_complete=false`.
 * The wizard, on completion, flips the flag so the next mount lands on
 * /app instead.
 */

import type { JSX } from "react";
import { OnboardingWizard } from "@/presentation/components/onboarding/OnboardingWizard";

export default function OnboardingPage(): JSX.Element {
  return <OnboardingWizard />;
}
