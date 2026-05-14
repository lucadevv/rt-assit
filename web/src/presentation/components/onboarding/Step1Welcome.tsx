"use client";

/**
 * Step 1 — Welcome. Hero gradient card + single primary CTA.
 *
 * Copy intentionally short; this is the hook, not the manual. The
 * `auri-hero-gradient` utility (F0) gives us the brand palette on a tall
 * card without per-instance shaders.
 */

import type { JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";

interface Step1WelcomeProps {
  onNext: () => void;
}

export function Step1Welcome({ onNext }: Step1WelcomeProps): JSX.Element {
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
        Bienvenido a Auri.
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.85)",
          maxWidth: 540,
        }}
      >
        Auri es tu copiloto en cualquier conversación importante:
        entrevistas, reuniones con clientes, exámenes orales o llamadas
        que querés repasar después. Te escuchamos en tiempo real y te
        damos hints accionables al instante.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          listStyle: "none",
          fontSize: 14,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        <li>· Hints en tu idioma, en menos de un segundo.</li>
        <li>· Privacy-first: tus datos no entrenan modelos ajenos.</li>
        <li>· Multi-escenario: entrevista, cliente, examen, personal.</li>
      </ul>
      <div style={{ marginTop: 8 }}>
        <Button variant="primary" size="md" onClick={onNext}>
          Empezar
        </Button>
      </div>
    </Card>
  );
}
