"use client";

/**
 * WizardNav — back / next button row at the bottom of each wizard step.
 *
 * Convention:
 *  - "Atrás" is hidden on step 1.
 *  - The right-hand button label adapts (`nextLabel` prop) so step 4 can
 *    say "Crear persona" instead of "Siguiente".
 *  - `nextDisabled` short-circuits the primary CTA so steps can gate on
 *    local validation (e.g. step 3 requires a scenario selected).
 *  - `onSkipStep` is optional — when set, an inline ghost button is
 *    surfaced ("Saltar este paso") so the user can skip CV upload without
 *    abandoning the whole wizard.
 */

import type { JSX } from "react";
import { Button } from "@/design-system/primitives";

interface WizardNavProps {
  onBack?: () => void;
  onNext: () => void;
  onSkipStep?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  /** When true, render no Back button (e.g. first step). */
  hideBack?: boolean;
}

export function WizardNav({
  onBack,
  onNext,
  onSkipStep,
  nextLabel = "Siguiente",
  nextDisabled = false,
  nextLoading = false,
  hideBack = false,
}: WizardNavProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        marginTop: 4,
      }}
    >
      <div>
        {!hideBack && onBack ? (
          <Button variant="ghost" size="md" onClick={onBack}>
            Atrás
          </Button>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onSkipStep ? (
          <Button variant="ghost" size="md" onClick={onSkipStep}>
            Saltar este paso
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="md"
          onClick={onNext}
          disabled={nextDisabled || nextLoading}
        >
          {nextLoading ? "Guardando…" : nextLabel}
        </Button>
      </div>
    </div>
  );
}
