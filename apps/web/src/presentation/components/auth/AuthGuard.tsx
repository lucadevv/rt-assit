"use client";

/**
 * AuthGuard — declarative auth gate for protected routes.
 *
 * Responsibility:
 *  - Read auth store state.
 *  - loading → render <Spinner /> centered.
 *  - unauthenticated → router.replace("/sign-in") + render null.
 *  - authenticated → render children.
 *
 * Why declarative beats useEffect-based gating:
 *  - The useEffect approach races with downstream hooks (they fire before
 *    the redirect lands → 401 noise, see app/auth-gated-fetch-uniform-pattern).
 *  - The guard early-returns BEFORE children mount, so downstream hooks
 *    never execute on unauthenticated users.
 *  - State transitions are explicit: each render reflects a single
 *    "phase" (loading | unauth | auth). No effect ordering surprises.
 *
 * Trade-off: this triggers `router.replace` inside the render path via a
 * useEffect (Next router cannot be called during render). That's fine
 * because the children DO NOT render in this branch — only the redirect
 * effect runs. No race because nothing else is mounted.
 */

import { useEffect, type JSX, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/application/stores/auth.store";
import { useCurrentUser } from "@/presentation/hooks/use-current-user";
import { Spinner } from "@/design-system/primitives";

interface AuthGuardProps {
  children: ReactNode;
  /**
   * Where to redirect unauthenticated users. Default: /sign-in.
   * Useful for sub-routes that have a more specific entry page.
   */
  redirectTo?: string;
  /**
   * Custom fallback for the loading state. Default: centered Spinner.
   */
  loadingFallback?: ReactNode;
}

export function AuthGuard({
  children,
  redirectTo = "/sign-in",
  loadingFallback,
}: AuthGuardProps): JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();

  // useCurrentUser seeds the auth store from the AuthPort adapter.
  // Critical: this hook MUST be called inside the guard, not in a child,
  // so the store gets populated before children mount.
  useCurrentUser();

  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  // Redirect effect — fires only when truly unauthenticated, not loading.
  useEffect(() => {
    if (loading) return;
    if (user) return;
    // Avoid redirect loop if we're already on the redirect target.
    if (pathname === redirectTo) return;
    router.replace(redirectTo);
  }, [loading, user, router, redirectTo, pathname]);

  // Phase: loading
  if (loading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    return <CenteredSpinner />;
  }

  // Phase: unauthenticated — render nothing while the redirect lands
  if (!user) {
    return null;
  }

  // Phase: authenticated
  return <>{children}</>;
}

function CenteredSpinner(): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Cargando sesión"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 12,
        color: "var(--color-text-mid)",
        fontSize: 14,
      }}
    >
      <Spinner size={18} />
      <span>Cargando…</span>
    </div>
  );
}
