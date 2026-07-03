"use client";

/**
 * Protected `(app)` segment layout.
 *
 * Owns:
 *  - Wrapping all /app/* routes with <AuthGuard>.
 *  - Onboarding redirect for first-time users.
 *  - AppLayout chrome (TopBar + Sidebar).
 *  - Page transition animation via AnimatePresence.
 *
 * Auth gating moved to <AuthGuard> (Fase C). useCurrentUser is now called
 * INSIDE the guard so children never render on unauthenticated users.
 */

import { useEffect, type JSX, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { AppLayout } from "@/presentation/components/shell/AppLayout";
import { AuthGuard } from "@/presentation/components/auth/AuthGuard";
import { useOnboardingStatus } from "@/presentation/hooks/use-onboarding-status";
import { useBilling } from "@/presentation/hooks/use-billing";

export default function AppShellLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <AuthGuard>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </AuthGuard>
  );
}

function AuthenticatedShell({ children }: { children: ReactNode }): JSX.Element {
  const { shouldShow, loading: onboardingLoading } = useOnboardingStatus();
  const shouldReduceMotion = useReducedMotion();
  // Pre-boot the billing store now that auth is confirmed.
  useBilling();
  const router = useRouter();
  const pathname = usePathname();

  // Onboarding redirect — only fires for authenticated users.
  useEffect(() => {
    if (onboardingLoading) return;
    if (!shouldShow) return;
    if (pathname?.startsWith("/app/onboarding")) return;
    router.replace("/app/onboarding");
  }, [onboardingLoading, shouldShow, pathname, router]);

  return (
    <AppLayout>
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          style={{ minHeight: "100%" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </AppLayout>
  );
}
