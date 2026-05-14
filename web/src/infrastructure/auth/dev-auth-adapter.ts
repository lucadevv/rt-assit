"use client";

/**
 * DevAuthAdapter — implements `AuthPort` without any external auth provider.
 *
 * Active when `NEXT_PUBLIC_AUTH_MODE=dev` (default). Synthesises the same
 * `dev_default` user the backend's AUTH_MODE=dev synthesises, so the full
 * stack works end-to-end without Clerk credentials.
 *
 * `getToken` returns `null` deliberately — the backend dev mode does NOT
 * require a Bearer token, it just looks at the absence of an Authorization
 * header to fall back to the dev user.
 */

import type { AuthPort, AuthState } from "@/application/ports/auth.port";
import type { User } from "@/domain/entities/user";

const DEV_USER: User = {
  id: "dev_default",
  email: "dev@auri.local",
  name: "Dev User",
  avatarUrl: null,
  tier: "free",
  languagePreferred: "es-419",
  // Static timestamps so the SSR-rendered HTML matches the client-rendered
  // HTML (no hydration mismatch). The real user record from /api/me will
  // override these as soon as the home effect resolves.
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// Stable singleton — referential equality across renders is critical for the
// container's useMemo([auth]) dependency, otherwise use cases get re-created
// on every render and useEffect-driven fetches loop infinitely.
const DEV_AUTH_STATE: AuthState = {
  status: "authenticated",
  user: DEV_USER,
  getToken: async () => null,
};

const DEV_AUTH_PORT: AuthPort = {
  getState: () => DEV_AUTH_STATE,
  async signOut() {
    // eslint-disable-next-line no-console -- intentional debug breadcrumb
    console.info("[auri/dev-auth] signOut() ignored (dev mode)");
  },
};

export function useDevAuthAdapter(): AuthPort {
  return DEV_AUTH_PORT;
}
