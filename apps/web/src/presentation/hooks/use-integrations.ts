"use client";

/**
 * useIntegrations — single consumer of the Meeting Frame OAuth state.
 *
 * Responsibilities:
 *  - Trigger initial fetch on mount (StrictMode-deduped).
 *  - Drive the popup-based OAuth flow:
 *      1. Hit `GET /api/oauth/{provider}/authorize` to obtain the consent URL.
 *      2. `window.open()` a popup.
 *      3. Wait for `postMessage({ type: 'susurra-oauth-complete', ... })`
 *         from the `/oauth-callback` page OR detect the popup being closed
 *         manually.
 *      4. On success, refresh the connected list.
 *  - Disconnect (revoke + remove from store).
 *  - Surface failures via the store's `error` field so the page can render
 *    a banner.
 *
 * The popup flow is intentionally NOT a use case — it depends on browser
 * APIs (`window.open`, `addEventListener`, `screen`) that belong to the
 * presentation layer.
 */

import { useCallback, useEffect, useRef } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useOAuthIntegrationsStore } from "@/application/stores/oauth-integrations.store";
import type {
  ConnectedIntegration,
  OAuthProviderId,
} from "@/domain/entities/oauth-integration";

interface UseIntegrationsResult {
  integrations: ConnectedIntegration[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  popupOpen: boolean;
  refresh: () => Promise<void>;
  connect: (provider: OAuthProviderId) => Promise<void>;
  disconnect: (provider: OAuthProviderId) => Promise<void>;
}

interface OAuthCompleteMessage {
  type: "susurra-oauth-complete";
  provider: OAuthProviderId;
  status: "success" | "error" | "cancelled";
  error?: string;
}

const POPUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const POPUP_POLL_MS = 500;

/**
 * Wait for the popup to either:
 *  - postMessage a `susurra-oauth-complete` payload (success / error),
 *  - close manually (returns `{ status: 'cancelled' }`),
 *  - or hit the 5-minute timeout (rejects).
 *
 * Cleans up the event listener and poll interval on every exit path.
 */
function waitForOAuthPostMessage(
  popup: Window,
): Promise<OAuthCompleteMessage> {
  return new Promise<OAuthCompleteMessage>((resolve, reject) => {
    let settled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      settled = true;
      window.removeEventListener("message", handler);
      if (pollId !== undefined) clearInterval(pollId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };

    const handler = (ev: MessageEvent): void => {
      if (settled) return;
      // Same-origin guard: popup is on our own origin (the /oauth-callback
      // route under apps/web).
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as unknown;
      if (
        !data ||
        typeof data !== "object" ||
        (data as { type?: unknown }).type !== "susurra-oauth-complete"
      ) {
        return;
      }
      cleanup();
      resolve(data as OAuthCompleteMessage);
    };

    window.addEventListener("message", handler);

    pollId = setInterval(() => {
      if (settled) return;
      if (popup.closed) {
        cleanup();
        // We may have a race with the postMessage path — but the message
        // handler already resolves before the popup closes, so if we reach
        // here it really was a manual close.
        resolve({
          type: "susurra-oauth-complete",
          provider: "google",
          status: "cancelled",
        });
      }
    }, POPUP_POLL_MS);

    timeoutId = setTimeout(() => {
      if (settled) return;
      cleanup();
      try {
        popup.close();
      } catch {
        /* ignore — popup might be cross-origin briefly during the OAuth flow */
      }
      reject(new Error("La autorización expiró. Volvé a intentar."));
    }, POPUP_TIMEOUT_MS);
  });
}

export function useIntegrations(): UseIntegrationsResult {
  const {
    listConnectedIntegrations,
    startOAuthConnect,
    disconnectOAuthProvider,
  } = useContainer();

  const integrations = useOAuthIntegrationsStore((s) => s.integrations);
  const loading = useOAuthIntegrationsStore((s) => s.loading);
  const error = useOAuthIntegrationsStore((s) => s.error);
  const hasFetched = useOAuthIntegrationsStore((s) => s.hasFetched);
  const popupOpen = useOAuthIntegrationsStore((s) => s.popupOpen);
  const setIntegrations = useOAuthIntegrationsStore((s) => s.setIntegrations);
  const setLoading = useOAuthIntegrationsStore((s) => s.setLoading);
  const setError = useOAuthIntegrationsStore((s) => s.setError);
  const setPopupOpen = useOAuthIntegrationsStore((s) => s.setPopupOpen);
  const setHasFetched = useOAuthIntegrationsStore((s) => s.setHasFetched);
  const removeIntegration = useOAuthIntegrationsStore(
    (s) => s.removeIntegration,
  );

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await listConnectedIntegrations.execute();
      setIntegrations(list);
      setHasFetched(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      // Degrade gracefully — empty list + banner, no crash.
      setIntegrations([]);
      setHasFetched(true);
      setError(`No se pudieron cargar las integraciones: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [
    listConnectedIntegrations,
    setIntegrations,
    setError,
    setHasFetched,
    setLoading,
  ]);

  const connect = useCallback(
    async (provider: OAuthProviderId): Promise<void> => {
      try {
        setError(null);
        setPopupOpen(true);
        const { url } = await startOAuthConnect.execute(provider);

        const width = 600;
        const height = 700;
        const left = Math.max(0, Math.floor(window.screen.width / 2 - width / 2));
        const top = Math.max(0, Math.floor(window.screen.height / 2 - height / 2));
        const popup = window.open(
          url,
          "susurra-oauth",
          `width=${width},height=${height},left=${left},top=${top}`,
        );

        if (!popup) {
          throw new Error(
            "Popup bloqueado. Permití popups para Susurra y volvé a intentar.",
          );
        }

        const result = await waitForOAuthPostMessage(popup);
        if (result.status === "success" && result.provider === provider) {
          await refresh();
        } else if (result.status === "cancelled") {
          // Quiet exit — user closed the popup intentionally.
        } else {
          throw new Error(result.error ?? "Conexión cancelada.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
      } finally {
        setPopupOpen(false);
      }
    },
    [startOAuthConnect, refresh, setError, setPopupOpen],
  );

  const disconnect = useCallback(
    async (provider: OAuthProviderId): Promise<void> => {
      try {
        await disconnectOAuthProvider.execute(provider);
        removeIntegration(provider);
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo desconectar: ${msg}`);
        throw err;
      }
    },
    [disconnectOAuthProvider, removeIntegration, setError],
  );

  // StrictMode dedup — see use-personas.ts for the rationale.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    if (!hasFetched && !loading) {
      fetchedRef.current = true;
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFetched]);

  return {
    integrations,
    loading,
    error,
    hasFetched,
    popupOpen,
    refresh,
    connect,
    disconnect,
  };
}
