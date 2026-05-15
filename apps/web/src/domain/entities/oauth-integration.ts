/**
 * OAuth Integration — domain types for the Meeting Frame OAuth flow.
 *
 * The Meeting Frame integrates three meeting providers (Sprint 1: Google
 * Meet; Sprint 2: Microsoft Teams; Sprint 3: Zoom). Each provider has a
 * per-user OAuth credential stored Fernet-encrypted by the backend. The
 * frontend never holds tokens — it only knows whether a user is connected
 * and when the access token expires.
 *
 * Sprint 1 ships only `google`; `microsoft` and `zoom` are marked as
 * unavailable (their backend endpoints return 501 until the sprint lands).
 */

export const OAUTH_PROVIDERS = ["google", "microsoft", "zoom"] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

/**
 * A provider the current user has connected. The frontend stores this as
 * a read-model derived from `GET /api/oauth/connected` (no tokens leaked).
 */
export interface ConnectedIntegration {
  provider: OAuthProviderId;
  /** Epoch milliseconds (matches `expires_at` from the backend). */
  expiresAt: number;
  /** Pre-computed at adapter boundary: `expiresAt <= Date.now()`. */
  isExpired: boolean;
}

/**
 * Static catalog used by the Integrations UI to render every provider
 * — even when the user has none connected — so they can discover what's
 * available and what's coming soon.
 */
export interface ProviderMetadata {
  id: OAuthProviderId;
  displayName: string;
  description: string;
  /** Sprint-1 gate: Microsoft & Zoom are `false` until they ship. */
  available: boolean;
}

export const PROVIDER_METADATA: Record<OAuthProviderId, ProviderMetadata> = {
  google: {
    id: "google",
    displayName: "Google Meet",
    description:
      "Creá y unite a reuniones de Meet desde Susurra.",
    available: true,
  },
  microsoft: {
    id: "microsoft",
    displayName: "Microsoft Teams",
    description:
      "Próximamente — integración con Teams vía Azure Communication Services.",
    available: false,
  },
  zoom: {
    id: "zoom",
    displayName: "Zoom",
    description: "Próximamente — integración con Zoom Meeting SDK.",
    available: false,
  },
};
