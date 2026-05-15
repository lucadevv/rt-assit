"use client";

/**
 * AppShellClient — client-only wrapper for the app root.
 *
 * Owns:
 *  - Sentry browser init (idempotent, gated by NEXT_PUBLIC_SENTRY_DSN).
 *  - Global ErrorBoundary that catches every render error below the
 *    document root.
 *  - SkipToContent — first focusable element on every page (a11y).
 *
 * The root `app/layout.tsx` stays a server component (so it can decide
 * whether to mount ClerkProvider via env var) and delegates client-only
 * concerns to this component.
 */

import { useEffect, type JSX, type ReactNode } from "react";
import { initSentry } from "@/infrastructure/error-tracking/sentry-init";
import { ErrorBoundary } from "@/presentation/components/a11y/ErrorBoundary";
import { SkipToContent } from "@/presentation/components/a11y/SkipToContent";

interface AppShellClientProps {
  children: ReactNode;
}

export function AppShellClient({
  children,
}: AppShellClientProps): JSX.Element {
  useEffect(() => {
    initSentry();
  }, []);

  return (
    <>
      <SkipToContent />
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
}
