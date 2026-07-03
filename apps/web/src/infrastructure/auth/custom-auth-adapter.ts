"use client";

/**
 * CustomAuthAdapter — implements `AuthPort` against the Susurra cookie
 * session (Fase A+D backend).
 *
 * The access JWT lives in an HttpOnly cookie that browser handles
 * automatically. Frontend JS NEVER sees the token (XSS-resistant by
 * design). Identity comes from the auth store, which is populated by
 * `useCurrentUser` via GET /api/me.
 *
 * `signOut()` calls POST /api/auth/logout (the FetchApiClient sends the
 * cookie via `credentials: "include"`). The cookies are cleared by the
 * server's Set-Cookie response. After that, the local Zustand state is
 * reset.
 *
 * No `getToken` is exposed — cookie-based auth doesn't need a JS-side
 * token getter. The FetchApiClient already sends `credentials: "include"`
 * on every request.
 */

import { useEffect, useMemo, useState } from "react";
import type { AuthPort, AuthState } from "@/application/ports/auth.port";
import { useAuthStore } from "@/application/stores/auth.store";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8767";

export function useCustomAuthAdapter(): AuthPort {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const reset = useAuthStore((s) => s.reset);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return useMemo<AuthPort>(() => {
    return {
      getState(): AuthState {
        if (!ready || loading) {
          return { status: "loading" };
        }
        if (!user) {
          return { status: "unauthenticated" };
        }
        return {
          status: "authenticated",
          user,
        };
      },
      async signOut() {
        try {
          await fetch(`${API_BASE}/api/auth/logout`, {
            method: "POST",
            credentials: "include",
          });
        } catch {
          // Network failure — local cleanup runs anyway
        }
        reset();
      },
    };
  }, [ready, loading, user, reset]);
}
