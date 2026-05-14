"use client";

/**
 * Global ErrorBoundary — catches render-time errors below the app root.
 *
 * - React requires a class component for `getDerivedStateFromError` /
 *   `componentDidCatch`. There is no functional API for this lifecycle.
 * - On error: forward to Sentry (only when DSN is configured) AND log to
 *   the console. The fallback UI offers a Retry that resets local state;
 *   navigation away (router.replace) is also safe because component
 *   re-mount clears the boundary.
 * - Uses Auri primitives (Card, Button) so the fallback inherits theme
 *   tokens — no jarring "system error" page.
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import * as Sentry from "@sentry/nextjs";
import { Card, Button } from "@/design-system/primitives";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_SENTRY_DSN
    ) {
      Sentry.captureException(error, {
        extra: { componentStack: errorInfo.componentStack },
      });
    }
    // eslint-disable-next-line no-console -- last-resort dev breadcrumb
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? "Error inesperado";
      return (
        <div
          role="alert"
          style={{
            padding: 32,
            maxWidth: 540,
            margin: "64px auto",
          }}
        >
          <Card padded variant="default">
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.6px",
              }}
            >
              Algo se rompió
            </h1>
            <p
              style={{
                margin: "10px 0 18px",
                color: "var(--color-text-mid)",
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              {message}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={this.handleReset}>
                Reintentar
              </Button>
              <Button variant="ghost" onClick={this.handleReload}>
                Recargar página
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
