"use client";

/**
 * PromoCodeForm — input + validate button.
 *
 * The form does NOT apply the promo (that happens during checkout via
 * `createCheckout({ promoCode })`). It only validates so the user gets
 * confidence before clicking "Mejorar".
 *
 * Result UX:
 *  - valid=true  → green callout with discount
 *  - valid=false → amber callout with `reason`
 */

import { useState, type JSX } from "react";
import { Button, Card, Input, Pill } from "@/design-system/primitives";
import { useContainer } from "@/infrastructure/di/container";
import type { PromoValidateResult } from "@/application/ports/billing-api.port";
import { formatMoneyCents } from "./utils";

export function PromoCodeForm(): JSX.Element {
  const { validatePromo } = useContainer();
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<PromoValidateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!code.trim()) return;
    setValidating(true);
    setError(null);
    setResult(null);
    try {
      const r = await validatePromo.execute({ code: code.trim() });
      setResult(r);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos validar el código.";
      // eslint-disable-next-line no-console -- dev surface
      console.error("[susurra] validatePromo failed:", err);
      setError(msg);
    } finally {
      setValidating(false);
    }
  };

  const renderResult = (): JSX.Element | null => {
    if (error) {
      return (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 12,
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </p>
      );
    }
    if (!result) return null;
    if (!result.valid) {
      return (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 12,
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Pill variant="ghost">No válido</Pill>
          <span>{result.reason ?? "Código no aplicable"}</span>
        </div>
      );
    }
    let discountLabel = "Descuento aplicable";
    if (result.discountType === "percentage" && result.discountValue !== null) {
      discountLabel = `${result.discountValue}% de descuento`;
    } else if (
      result.discountType === "fixed_amount" &&
      result.discountValue !== null
    ) {
      discountLabel = `${formatMoneyCents(result.discountValue)} de descuento`;
    } else if (result.discountType === "first_month_free") {
      discountLabel = "Primer mes gratis";
    }
    return (
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 12,
          background: "var(--color-lime)",
          color: "var(--color-lime-ink)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <Pill variant="dark">Válido</Pill>
        <span>{discountLabel}</span>
        <span style={{ opacity: 0.65, fontWeight: 600 }}>
          · se aplica al hacer checkout
        </span>
      </div>
    );
  };

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      aria-labelledby="promo-title"
    >
      <header>
        <h2
          id="promo-title"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.4px",
            color: "var(--color-text)",
          }}
        >
          ¿Tenés un código promocional?
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          Validá el código antes de hacer checkout. Se aplica automáticamente al pagar.
        </p>
      </header>

      <Card variant="default">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            htmlFor="promo-code"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            Código
          </label>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <Input
              id="promo-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="EJ: SUSURRA10"
              autoComplete="off"
              spellCheck={false}
              disabled={validating}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={validating || code.trim().length === 0}
          >
            {validating ? "Validando…" : "Validar"}
          </Button>
        </form>
        <div style={{ marginTop: 12 }}>{renderResult()}</div>
      </Card>
    </section>
  );
}
