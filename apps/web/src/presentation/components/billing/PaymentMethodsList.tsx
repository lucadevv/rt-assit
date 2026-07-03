"use client";

/**
 * PaymentMethodsList — list of saved payment methods + portal link.
 *
 * The portal CTA calls GetPortalUrlUseCase via the container, then
 * window.open()s the LS portal in a new tab. In dev mode the backend
 * returns null (DevBillingProvider has no portal); we surface a tooltip
 * and disable the button.
 */

import { useState, type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import type { PaymentMethod } from "@/domain/entities/payment-method";
import { useContainer } from "@/infrastructure/di/container";

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethod[];
  loading?: boolean;
}

function expString(month: number | null, year: number | null): string {
  if (!month || !year) return "—";
  const m = String(month).padStart(2, "0");
  const y = String(year).slice(-2);
  return `${m}/${y}`;
}

function brandLabel(brand: string | null, type: string): string {
  if (brand) return brand;
  if (type === "paypal") return "PayPal";
  return "Tarjeta";
}

export function PaymentMethodsList({
  paymentMethods,
  loading = false,
}: PaymentMethodsListProps): JSX.Element {
  const { getPortalUrl } = useContainer();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async (): Promise<void> => {
    setOpening(true);
    setError(null);
    try {
      const result = await getPortalUrl.execute();
      if (!result.portalUrl) {
        setError(
          "El portal de pagos no está disponible en este entorno. Conectá Lemon Squeezy para administrar tus métodos.",
        );
        return;
      }
      if (typeof window !== "undefined") {
        window.open(result.portalUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos abrir el portal de pagos.";
      // eslint-disable-next-line no-console -- dev surface
      console.error("[susurra] getPortalUrl failed:", err);
      setError(msg);
    } finally {
      setOpening(false);
    }
  };

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      aria-labelledby="pm-title"
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            id="pm-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.4px",
              color: "var(--color-text)",
            }}
          >
            Métodos de pago
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            Gestionados por Lemon Squeezy (procesador autorizado, PCI compliant).
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void openPortal()}
          disabled={opening}
        >
          {opening ? "Abriendo…" : "Administrar →"}
        </Button>
      </header>

      <Card variant="default" padded={false}>
        {loading ? (
          <div
            style={{
              padding: 20,
              fontSize: 13,
              color: "var(--color-text-mid)",
            }}
          >
            Cargando métodos de pago…
          </div>
        ) : paymentMethods.length === 0 ? (
          <div
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "flex-start",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--color-text-mid)",
              }}
            >
              Todavía no tenés métodos de pago guardados. Cuando completes
              tu primer checkout, tu tarjeta aparece acá.
            </p>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {paymentMethods.map((pm, idx) => (
              <li
                key={pm.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 18px",
                  borderTop:
                    idx === 0 ? "none" : "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--color-text)",
                      textTransform: "capitalize",
                    }}
                  >
                    {brandLabel(pm.brand, pm.type)}
                    {pm.lastFour ? ` •••• ${pm.lastFour}` : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-mid)",
                      fontFamily:
                        "var(--font-mono)",
                    }}
                  >
                    Vence {expString(pm.expMonth, pm.expYear)}
                  </span>
                </div>
                {pm.isDefault ? (
                  <Pill variant="lime">Predeterminado</Pill>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error ? (
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
      ) : null}
    </section>
  );
}
