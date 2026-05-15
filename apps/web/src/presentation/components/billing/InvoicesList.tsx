"use client";

/**
 * InvoicesList — table of past invoices + download PDF link.
 *
 * Empty state: clear copy. The "Descargar PDF" link is only shown when
 * `invoicePdfUrl` is non-null (dev provider returns null; LS provides
 * signed S3 URLs in prod).
 */

import type { JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import type { Invoice } from "@/domain/entities/invoice";
import {
  formatDateShort,
  formatMoneyCents,
  invoiceStatusDisplay,
} from "./utils";

interface InvoicesListProps {
  invoices: Invoice[];
  loading?: boolean;
}

export function InvoicesList({
  invoices,
  loading = false,
}: InvoicesListProps): JSX.Element {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      aria-labelledby="invoices-title"
    >
      <header>
        <h2
          id="invoices-title"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.4px",
            color: "var(--color-text)",
          }}
        >
          Facturas
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          Tus últimas facturas. Las guardamos por 7 años por requerimiento legal.
        </p>
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
            Cargando facturas…
          </div>
        ) : invoices.length === 0 ? (
          <div
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--color-text-mid)",
              }}
            >
              Aún no tenés facturas. Cuando empieces tu primer pago, tus
              comprobantes aparecen acá con el PDF descargable.
            </p>
          </div>
        ) : (
          <ul
            role="list"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <li
              aria-hidden="true"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(120px, 1.2fr) minmax(110px, 1fr) minmax(90px, 0.9fr) minmax(110px, 1fr) auto",
                gap: 12,
                padding: "10px 18px",
                fontSize: 11,
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--color-text-dim)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span>Factura</span>
              <span>Emitida</span>
              <span>Total</span>
              <span>Estado</span>
              <span style={{ textAlign: "right" }}>PDF</span>
            </li>
            {invoices.map((inv) => {
              const statusDisplay = invoiceStatusDisplay(inv.status);
              return (
                <li
                  key={inv.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(120px, 1.2fr) minmax(110px, 1fr) minmax(90px, 0.9fr) minmax(110px, 1fr) auto",
                    gap: 12,
                    padding: "14px 18px",
                    fontSize: 13,
                    color: "var(--color-text)",
                    borderTop: "1px solid var(--color-border)",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily:
                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                      fontSize: 12,
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={inv.invoiceNumber ?? inv.id}
                  >
                    {inv.invoiceNumber ?? inv.id.slice(0, 8)}
                  </span>
                  <span style={{ color: "var(--color-text-mid)" }}>
                    {formatDateShort(inv.issuedAt)}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {formatMoneyCents(inv.totalCents, inv.currency)}
                  </span>
                  <span>
                    <Pill variant={statusDisplay.variant}>
                      {statusDisplay.label}
                    </Pill>
                  </span>
                  <span style={{ textAlign: "right" }}>
                    {inv.invoicePdfUrl ? (
                      <a
                        href={inv.invoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12,
                          color: "var(--color-text)",
                          textDecoration: "underline",
                          fontWeight: 600,
                        }}
                      >
                        Descargar
                      </a>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-dim)",
                        }}
                      >
                        —
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
