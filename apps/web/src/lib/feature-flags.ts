/**
 * Feature flags — compile-time gates backed by NEXT_PUBLIC_* env vars.
 *
 * To enable a flag locally, set the corresponding var in `.env.local`:
 *
 *   NEXT_PUBLIC_FEATURE_OCR_DEBUG=true
 */

function flag(value: string | undefined): boolean {
  return value === "true";
}

export const OCR_DEBUG_ENABLED: boolean = flag(
  process.env.NEXT_PUBLIC_FEATURE_OCR_DEBUG,
);
