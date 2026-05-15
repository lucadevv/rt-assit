/**
 * OAuth Integrations store (Zustand 5) — owns the user's connected
 * Meeting Frame providers.
 *
 * Why a store (instead of per-page state):
 *  - The Integrations page and (future) Live page both need to know
 *    whether the user has Google Meet connected before they can create
 *    a meeting space. Single shared source avoids parallel fetches.
 *  - `popupOpen` is global so other Connect buttons can disable
 *    themselves while one OAuth flow is in flight.
 *
 * No infrastructure imports here — domain types only (Clean Arch mandate).
 */

import { create } from "zustand";
import type {
  ConnectedIntegration,
  OAuthProviderId,
} from "@/domain/entities/oauth-integration";

interface OAuthIntegrationsStoreState {
  integrations: ConnectedIntegration[];
  loading: boolean;
  error: string | null;
  /**
   * True while a popup-based OAuth flow is in progress (from user click on
   * "Conectar" through to popup close / postMessage / timeout). Other
   * connect buttons consult this to disable themselves.
   */
  popupOpen: boolean;
  /**
   * Mirrors the pattern in personas.store / documents store — prevents
   * flashing the empty state during the initial load.
   */
  hasFetched: boolean;

  setIntegrations: (list: ConnectedIntegration[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setPopupOpen: (v: boolean) => void;
  setHasFetched: (v: boolean) => void;
  /** Upsert after a successful connect (e.g. coming back from /oauth-callback). */
  addIntegration: (integration: ConnectedIntegration) => void;
  /** Remove after a successful revoke. */
  removeIntegration: (provider: OAuthProviderId) => void;
  reset: () => void;
}

export const useOAuthIntegrationsStore = create<OAuthIntegrationsStoreState>(
  (set) => ({
    integrations: [],
    loading: false,
    error: null,
    popupOpen: false,
    hasFetched: false,

    setIntegrations: (list) => set({ integrations: list }),
    setLoading: (v) => set({ loading: v }),
    setError: (e) => set({ error: e }),
    setPopupOpen: (v) => set({ popupOpen: v }),
    setHasFetched: (v) => set({ hasFetched: v }),

    addIntegration: (integration) =>
      set((state) => {
        const idx = state.integrations.findIndex(
          (i) => i.provider === integration.provider,
        );
        if (idx === -1) {
          return { integrations: [...state.integrations, integration] };
        }
        const next = state.integrations.slice();
        next[idx] = integration;
        return { integrations: next };
      }),

    removeIntegration: (provider) =>
      set((state) => ({
        integrations: state.integrations.filter((i) => i.provider !== provider),
      })),

    reset: () =>
      set({
        integrations: [],
        loading: false,
        error: null,
        popupOpen: false,
        hasFetched: false,
      }),
  }),
);

/** Pure selector: is the given provider connected (and not expired)? */
export function selectIsConnected(
  state: { integrations: ConnectedIntegration[] },
  provider: OAuthProviderId,
): boolean {
  return state.integrations.some(
    (i) => i.provider === provider && !i.isExpired,
  );
}
