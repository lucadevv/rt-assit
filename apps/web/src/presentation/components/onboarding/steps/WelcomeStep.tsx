"use client";

/**
 * WelcomeStep — Step 1/5. Brand-voice intro to the onboarding wizard.
 *
 * Voice cues (PRODUCT.md):
 *   - silencioso, atento, preciso
 *   - cercano (voseo) pero refinado
 *   - serif italic SOLO como acento — el wordmark "Susurra"
 *   - cero sparkles, cero "Empezar tu aventura 🚀"
 *
 * Layout:
 *   - Hero with diagonal hero-gradient (same util F0 introduced for the
 *     OnboardingShell so the visual identity is consistent across the
 *     wizard's first impression).
 *   - 3 numbered bullets that mirror the 3 setup steps coming next
 *     (CV / scenario / persona) — sets expectations without bloating
 *     the screen.
 */

import type { JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps): JSX.Element {
  return (
    <Card
      padded
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        background:
          "linear-gradient(135deg, var(--color-hero-h0) 0%, var(--color-hero-h1) 55%, var(--color-hero-h2) 100%)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.12)",
        padding: 32,
      }}
    >
      <Pill variant="lime">Bienvenido</Pill>
      <h1
        style={{
          margin: 0,
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: "-1px",
          lineHeight: 1.1,
        }}
      >
        Bienvenido a{" "}
        <em
          style={{
            fontFamily: "var(--font-serif, 'GT Sectra', Georgia, serif)",
            fontStyle: "italic",
            fontWeight: 500,
          }}
        >
          Susurra
        </em>
        .
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.88)",
          maxWidth: 540,
        }}
      >
        Sos el dev. Susurra es tu copilot íntimo en cada entrevista, code
        review o llamada técnica importante. Antes de tu primera sesión,
        configurá tres cosas que hacen toda la diferencia.
      </p>
      <ol
        style={{
          margin: 0,
          padding: "0 0 0 22px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 14,
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.55,
        }}
      >
        <li>
          <strong>Tu CV</strong> — para que Susurra sepa quién sos.
        </li>
        <li>
          <strong>Tu scenario</strong> — para que entienda dónde estás hoy.
        </li>
        <li>
          <strong>Tu persona</strong> — para que hable como vos.
        </li>
      </ol>
      <div style={{ marginTop: 8 }}>
        <Button variant="primary" size="md" onClick={onNext}>
          Empecemos
        </Button>
      </div>
    </Card>
  );
}
