"use client";

/**
 * OnboardingShell — outer chrome of the /app/onboarding flow.
 *
 * Owns:
 *  - Auri header (logo + skip link).
 *  - Step indicator (1 · 2 · 3 with active highlight).
 *  - Centered content slot for the active step.
 *
 * The shell is intentionally separate from the App chrome (TopBar +
 * Sidebar) — onboarding is a focused, distraction-free wizard. The
 * (app)/layout.tsx renders the shell INSIDE the AppLayout main slot, so
 * the user can still feel the global theme but without the dashboard
 * navigation noise.
 */

import type { JSX, ReactNode } from "react";
import { Logo } from "@/design-system/primitives";

interface OnboardingShellProps {
  currentStep: number;
  totalSteps: number;
  onSkip: () => void;
  children: ReactNode;
}

export function OnboardingShell({
  currentStep,
  totalSteps,
  onSkip,
  children,
}: OnboardingShellProps): JSX.Element {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 32,
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Logo size={32} variant="wordmark" />
        <button
          type="button"
          onClick={onSkip}
          aria-label="Saltar onboarding"
          style={{
            background: "transparent",
            border: "1px solid var(--color-border)",
            borderRadius: 9999,
            padding: "8px 14px",
            color: "var(--color-text-mid)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Saltar por ahora
        </button>
      </header>

      <nav
        aria-label="Progreso del onboarding"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {steps.map((step, idx) => {
          const isActive = step === currentStep;
          const isDone = step < currentStep;
          return (
            <div
              key={step}
              aria-current={isActive ? "step" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  fontFamily:
                    "var(--font-jetbrains, ui-monospace), monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  background: isActive || isDone
                    ? "var(--color-lime)"
                    : "var(--color-bg-soft)",
                  color: isActive || isDone
                    ? "var(--color-lime-ink)"
                    : "var(--color-text-mid)",
                  border: `1px solid ${
                    isActive
                      ? "var(--color-lime-ink)"
                      : "var(--color-border)"
                  }`,
                }}
              >
                {step}
              </span>
              {idx < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 2,
                    background: isDone
                      ? "var(--color-lime)"
                      : "var(--color-border)",
                    borderRadius: 2,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </nav>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {children}
      </section>
    </div>
  );
}
