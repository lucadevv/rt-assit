"use client";

/**
 * Step 3 — First session. Final step before throwing the user into the
 * live screen. Sets expectations (mic permissions, escenario picker) and
 * surfaces the single primary CTA.
 */

import type { JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";

interface Step3FirstSessionProps {
  onFinish: () => void;
}

export function Step3FirstSession({
  onFinish,
}: Step3FirstSessionProps): JSX.Element {
  return (
    <Card
      padded
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 32,
      }}
    >
      <Pill variant="cyan">Paso 3</Pill>
      <h2
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.7px",
        }}
      >
        Estás listo. Iniciemos tu primera sesión.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--color-text-mid)",
          lineHeight: 1.6,
          maxWidth: 540,
        }}
      >
        Cuando hagas click, Auri te va a pedir permiso para capturar el
        audio del sistema (la conversación que está pasando en tu
        navegador o reunión). Vas a ver la transcripción en tiempo real,
        los hints van a aparecer del lado derecho, y todo queda guardado
        en tu historia de sesiones.
      </p>
      <ul
        style={{
          margin: 0,
          padding: "0 0 0 22px",
          fontSize: 13,
          color: "var(--color-text)",
          lineHeight: 1.6,
        }}
      >
        <li>Elegí un escenario en la barra superior (entrevista / cliente / examen / personal).</li>
        <li>Hacé click en "Empezar sesión" cuando arranque la conversación.</li>
        <li>Cuando termine, "Detener" guarda el resumen y los action items.</li>
      </ul>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <Button variant="primary" size="md" onClick={onFinish}>
          Iniciar mi primera sesión
        </Button>
      </div>
    </Card>
  );
}
