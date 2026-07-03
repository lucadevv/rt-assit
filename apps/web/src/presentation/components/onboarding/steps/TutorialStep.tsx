"use client";

/**
 * TutorialStep — Step 5/5. Three visual frames that show how the live
 * page works, ending with the final CTA that flips
 * `onboarding_complete=true` and bounces the user to /app.
 *
 * Why 3 frames and not a video: PRODUCT.md asks for restraint — sparkles
 * and full motion design clash with the brand voice. Static frames with
 * a mini-mockup carry the same explanatory weight in less time.
 *
 * UX choices:
 *  - User-controlled (mini "Atrás" / "Siguiente" between frames). No
 *    autoplay because autoplay competes with the user's pace.
 *  - Frame dots (3 little circles) double as keyboard-accessible step
 *    indicators.
 *  - The "Listo, vamos a tu primera sesión" CTA only appears on frame 3
 *    so the user reads all three before being asked to commit.
 */

import { useState, type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";

interface TutorialStepProps {
  onBack: () => void;
  onFinish: () => Promise<void> | void;
  finishing: boolean;
}

interface Frame {
  title: string;
  body: string;
  mockup: JSX.Element;
}

export function TutorialStep({
  onBack,
  onFinish,
  finishing,
}: TutorialStepProps): JSX.Element {
  const [frame, setFrame] = useState(0);

  const frames: Frame[] = [
    {
      title: "1. Compartí la pestaña",
      body: "En tu Meet / Zoom / Teams, compartí la pestaña con audio. Susurra solo escucha esa pestaña — nunca el resto del sistema.",
      mockup: <ShareTabMockup />,
    },
    {
      title: "2. Susurra escucha y sugiere",
      body: "En tiempo real, transcribe la conversación y te sugiere qué decir. La sugerencia respeta tu CV, tu scenario y tu persona.",
      mockup: <HintMockup />,
    },
    {
      title: "3. Vos respondés con tus palabras",
      body: "Leés la sugerencia, la adaptás y la decís con tu voz. Susurra es tu copiloto, no tu doble — vos siempre llevás la conversación.",
      mockup: <ResponseMockup />,
    },
  ];

  const isLast = frame === frames.length - 1;
  const current = frames[frame]!;

  const prevFrame = (): void => {
    if (frame > 0) setFrame(frame - 1);
  };
  const nextFrame = (): void => {
    if (frame < frames.length - 1) setFrame(frame + 1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        padded
        variant="soft"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <Pill variant="amber">Paso 5</Pill>
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.6px",
          }}
        >
          Así se usa Susurra
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-text-mid)",
            lineHeight: 1.55,
          }}
        >
          Tres pantallazos para que sepas qué esperar antes de tu primera
          sesión.
        </p>
      </Card>

      <Card padded>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "var(--color-bg-soft)",
              border: "1px solid var(--color-border)",
              borderRadius: 16,
              padding: 24,
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {current.mockup}
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            {current.title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--color-text-mid)",
              lineHeight: 1.55,
            }}
          >
            {current.body}
          </p>

          <div
            role="tablist"
            aria-label="Frame del tutorial"
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginTop: 4,
            }}
          >
            {frames.map((_, idx) => {
              const isActive = idx === frame;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Ir al frame ${idx + 1}`}
                  onClick={() => setFrame(idx)}
                  style={{
                    appearance: "none",
                    cursor: "pointer",
                    width: isActive ? 24 : 8,
                    height: 8,
                    borderRadius: 999,
                    background: isActive
                      ? "var(--color-coral, #E55A3F)"
                      : "var(--color-border)",
                    border: "none",
                    transition: "width 200ms cubic-bezier(0.23, 1, 0.32, 1)",
                  }}
                />
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={prevFrame}
              disabled={frame === 0}
            >
              Atrás
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextFrame}
              disabled={isLast}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Button variant="ghost" size="md" onClick={onBack}>
          Atrás
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            void onFinish();
          }}
          disabled={finishing}
        >
          {finishing
            ? "Guardando…"
            : "Listo, vamos a tu primera sesión"}
        </Button>
      </div>
    </div>
  );
}

// ---------- mockups (pure CSS, no images) ----------

function ShareTabMockup(): JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        maxWidth: 360,
      }}
    >
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: "10px 12px",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-mid)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--color-coral, #E55A3F)",
          }}
        />
        meet.google.com — Compartiendo pestaña con audio
      </div>
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background:
              "linear-gradient(135deg, var(--color-hero-h0, #0a0a1f) 0%, var(--color-hero-h2, #2a1140) 100%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>
            Susurra escucha esta pestaña
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-mid)",
            }}
          >
            Permiso de captura activo
          </span>
        </div>
      </div>
    </div>
  );
}

function HintMockup(): JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        maxWidth: 360,
      }}
    >
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 11,
          color: "var(--color-text-mid)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Interviewer · 00:12
      </div>
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
          color: "var(--color-text)",
        }}
      >
        “How did you handle state in your last Flutter app?”
      </div>
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(229,90,63,0.12), rgba(229,90,63,0.04))",
          border: "1px solid var(--color-coral, #E55A3F)",
          borderRadius: 10,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--color-coral, #E55A3F)",
          }}
        >
          Sugerencia · 0.6s
        </span>
        <span style={{ fontSize: 13, color: "var(--color-text)" }}>
          Mencioná Riverpod como elección final y por qué descartaste Provider.
        </span>
      </div>
    </div>
  );
}

function ResponseMockup(): JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "100%",
        maxWidth: 360,
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
          color: "var(--color-text-mid)",
          fontStyle: "italic",
        }}
      >
        Vos leés la sugerencia…
      </div>
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
          color: "var(--color-text)",
          alignSelf: "flex-end",
          maxWidth: "85%",
        }}
      >
        “Terminé con Riverpod — Provider me quedaba corto cuando la
        composición de providers se complicaba…”
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-mid)",
          alignSelf: "flex-end",
          letterSpacing: "0.6px",
        }}
      >
        Vos · ahora
      </div>
    </div>
  );
}
