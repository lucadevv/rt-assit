"use client";

/**
 * HeroBanner — top of the F4 Home dashboard.
 *
 * Big violet gradient card with the user's first name + tier label + CTA
 * "Empezar sesión" → opens the Modal Nueva Sesión (Wave 2B).
 *
 * Uses the global utility class `.susurra-hero-gradient` defined in F0
 * (web/src/app/globals.css) so the gradient is consistent with the brand
 * tokens (--color-hero-h0/h1/h2). Theme dark/light is handled by those
 * vars themselves — no per-theme override here.
 */

import { useState, type JSX } from "react";
import { Button } from "@/design-system/primitives";
import { ArrowRightIcon } from "@/design-system/icons";
import type { UserTier } from "@/domain/entities/user";
import { NewSessionModal } from "@/presentation/components/sessions/NewSessionModal";

interface HeroBannerProps {
  userName: string;
  tier: UserTier;
}

const TIER_LABEL: Record<UserTier, string> = {
  free: "Plan Free",
  pro: "Plan Pro",
  premium: "Plan Premium",
  byok: "Plan BYOK",
};

export function HeroBanner({ userName, tier }: HeroBannerProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="susurra-hero-gradient"
      aria-label="Saludo y CTA principal"
      style={{
        borderRadius: 22,
        padding: "40px 32px",
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          opacity: 0.75,
          margin: "0 0 12px",
        }}
      >
        {TIER_LABEL[tier]}
      </p>
      <h1
        style={{
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: "-1.4px",
          margin: "0 0 8px",
          lineHeight: 1.05,
        }}
      >
        Hola, {userName}
      </h1>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.5,
          opacity: 0.85,
          margin: "0 0 24px",
          maxWidth: 540,
        }}
      >
        Susurra está listo para acompañarte. Iniciá una sesión cuando estés en
        una conversación importante.
      </p>
      <Button
        variant="primary"
        size="lg"
        trailingIcon={<ArrowRightIcon size={16} />}
        onClick={() => setOpen(true)}
      >
        Empezar sesión
      </Button>
      <NewSessionModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
