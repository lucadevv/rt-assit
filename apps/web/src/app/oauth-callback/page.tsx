"use client";

/**
 * /oauth-callback — popup landing page.
 *
 * Flow:
 *   1. Backend `/api/oauth/{provider}/callback` exchanges the code +
 *      persists the credential, then 303-redirects the popup HERE with
 *      `?provider=google&status=success` (or `&status=error&error=...`).
 *   2. This page reads the query params, fires a `postMessage` to the
 *      opener (the Integrations page), then closes the popup.
 *   3. The opener's `useIntegrations()` hook catches the message and
 *      refreshes the connected list.
 *
 * If the user landed here directly (no opener), redirect to the
 * Integrations settings page so they don't see a dead-end.
 *
 * NOTE: `useSearchParams` MUST be wrapped in `Suspense` per Next.js 14+
 * rules — otherwise `next build` fails the prerender check.
 */

import { Suspense, useEffect, type JSX } from "react";
import { useSearchParams } from "next/navigation";

interface OAuthCompleteMessage {
  type: "susurra-oauth-complete";
  provider: string | null;
  status: "success" | "error";
  error?: string;
}

function OAuthCallbackInner(): JSX.Element {
  const searchParams = useSearchParams();
  const provider = searchParams?.get("provider") ?? null;
  const statusParam = searchParams?.get("status") ?? null;
  const errorParam = searchParams?.get("error") ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!window.opener) {
      // User opened this URL directly — redirect to settings.
      window.location.href = "/app/settings/integrations";
      return;
    }

    const message: OAuthCompleteMessage = {
      type: "susurra-oauth-complete",
      provider,
      status: statusParam === "success" ? "success" : "error",
      ...(errorParam ? { error: errorParam } : {}),
    };

    try {
      window.opener.postMessage(message, window.location.origin);
    } catch {
      // Opener might be cross-origin in some edge cases — ignore.
    }

    // Small delay so the parent has time to receive the message before
    // we tear down the popup.
    const closeTimer = setTimeout(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }, 200);

    return () => clearTimeout(closeTimer);
  }, [provider, statusParam, errorParam]);

  return (
    <main
      style={{
        padding: 48,
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        color: "#1a1a1a",
        background: "#fafafa",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <h1 style={{ fontSize: 22, margin: 0, fontWeight: 600 }}>
        {statusParam === "success" ? "Cuenta conectada" : "Procesando…"}
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: "#555" }}>
        Esta ventana se cerrará automáticamente.
      </p>
    </main>
  );
}

export default function OAuthCallbackPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main
          style={{
            padding: 48,
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p>Cargando…</p>
        </main>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
