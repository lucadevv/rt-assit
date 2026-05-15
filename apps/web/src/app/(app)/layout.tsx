"use client";

/**
 * Protected `(app)` segment layout.
 *
 * Owns:
 *  - Auth gating (redirects to /sign-in when unauthenticated)
 *  - First /api/me fetch (via useCurrentUser → seeds the auth store)
 *  - First-time user redirect to /app/onboarding (F9)
 *  - Mounting the AppLayout chrome (TopBar + Sidebar)
 *
 * The Next.js `(app)` route group keeps these routes URL-prefixed under
 * /app while sharing this single layout. Sub-pages (Home, Live, etc.) are
 * thin server-renderable bindings that import composites from
 * `presentation/`.
 *
 * F9 onboarding redirect: when `useOnboardingStatus().shouldShow` is
 * true AND we're not already on /app/onboarding, replace into the
 * wizard. Skipping the URL prefix check would cause an infinite loop on
 * the wizard route.
 */

import { useEffect, type JSX, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/presentation/components/shell/AppLayout";
import { useCurrentUser } from "@/presentation/hooks/use-current-user";
import { useOnboardingStatus } from "@/presentation/hooks/use-onboarding-status";
import { useBilling } from "@/presentation/hooks/use-billing";
import { Spinner } from "@/design-system/primitives";

export default function AppShellLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element | null {
  const { user, loading } = useCurrentUser();
  const { shouldShow, loading: onboardingLoading } = useOnboardingStatus();
  // Boot BillingStore once per app shell so `useTierGate(...)` works on any
  // route — not just /app/billing or /app/recordings. Without this, cold
  // navigations to /app/live show "no_subscription" upgrade banners even
  // for Premium users because the gate reads from an empty store.
  useBilling();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/sign-in");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || onboardingLoading) return;
    if (!user) return;
    if (!shouldShow) return;
    if (pathname?.startsWith("/app/onboarding")) return;
    router.replace("/app/onboarding");
  }, [loading, onboardingLoading, user, shouldShow, pathname, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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

  if (!user) {
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
