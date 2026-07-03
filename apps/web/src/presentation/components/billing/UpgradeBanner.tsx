"use client";

/**
 * UpgradeBanner — reusable callout shown wherever a tier-gated feature
 * is locked. Pairs with `useTierGate(feature)`:
 *
 *   const gate = useTierGate("voice_fingerprinting");
 *   if (!gate.available && gate.requiredTier) {
 *     return <UpgradeBanner feature="huellas de voz"
 *                           requiredTier={gate.requiredTier} />;
 *   }
 *
 * Visual: amber-tinted Card with copy + CTA "Mejorar a {tier} →" linking
 * to /app/billing.
 */

import type { JSX } from "react";
import Link from "next/link";
import { Card, Pill } from "@/design-system/primitives";
import { tierName, tierPillVariant } from "./utils";
import type { RequiredTier } from "@/application/use-cases/check-feature-availability";

interface UpgradeBannerProps {
  /** User-readable feature name in Spanish, e.g. "huellas de voz". */
  feature: string;
  requiredTier: RequiredTier;
  /** Optional override copy when the default doesn't fit. */
  description?: string;
}

export function UpgradeBanner({
  feature,
  requiredTier,
  description,
}: UpgradeBannerProps): JSX.Element {
  const tier = tierName(requiredTier);
  const variant = tierPillVariant(requiredTier);
  const defaultDescription = `Esta función está disponible en el plan ${tier}.`;

  return (
    <Card
      variant="warm"
      bordered={false}
      style={{
        background: "var(--color-amber)",
        color: "var(--color-amber-ink)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Pill variant={variant}>Plan {tier}</Pill>
            <span
              style={{
                fontFamily:
                  "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                opacity: 0.7,
              }}
            >
              {feature}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            {description ?? defaultDescription}
          </p>
        </div>
        <Link
          href="/app/billing"
          style={{
            background: "var(--color-amber-ink)",
            color: "var(--color-amber)",
            fontFamily: "var(--font-inter)",
            fontWeight: 700,
            fontSize: 13,
            padding: "10px 18px",
            borderRadius: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Mejorar a {tier} →
        </Link>
      </div>
    </Card>
  );
}
