/**
 * Invoice domain entity — TypeScript mirror of the backend `Invoice`
 * entity.
 *
 * Backend contract (GET /api/billing/invoices as `InvoiceResponse`):
 *
 *   {
 *     id: string,
 *     subscription_id: string | null,
 *     invoice_number: string | null,           // human-readable id
 *     subtotal_cents: integer,
 *     discount_cents: integer,
 *     tax_cents: integer,
 *     total_cents: integer,
 *     currency: string,                        // "USD"
 *     status: "draft" | "pending" | "paid" | "failed"
 *           | "refunded" | "partially_refunded",
 *     period_start: string | null,             // ISO 8601 UTC
 *     period_end: string | null,
 *     issued_at: string,
 *     paid_at: string | null,
 *     invoice_pdf_url: string | null
 *   }
 *
 * Money is stored as integer cents; presentation formats as currency.
 */

export type InvoiceStatus =
  | "draft"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export interface Invoice {
  id: string;
  subscriptionId: string | null;
  invoiceNumber: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  status: InvoiceStatus;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
  paidAt: string | null;
  invoicePdfUrl: string | null;
}
