"use client";

/**
 * /sign-in — login page.
 *
 * In dev mode (NEXT_PUBLIC_AUTH_MODE=dev) we never reach this page in the
 * happy path because the dev auth adapter always reports
 * `authenticated`. The route guard in (app)/layout.tsx only redirects here
 * when the auth state goes `unauthenticated`. To keep the dev experience
 * smooth in case someone lands here directly (e.g. typed URL), we
 * auto-bounce back to /app.
 *
 * In Clerk mode the page becomes a real Clerk SignIn host. For F1 we ship
 * a placeholder CTA so the URL responds 200 — F1 future ticket can drop
 * <SignIn /> here once Clerk keys are configured.
 */

import { useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";
import { Button, Logo } from "@/design-system/primitives";
import { AUTH_MODE } from "@/infrastructure/auth/auth-factory";

export default function SignInPage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    if (AUTH_MODE === "dev") {
      router.replace("/app");
    }
  }, [router]);

  if (AUTH_MODE === "dev") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: 14,
          color: "var(--color-text-mid)",
        }}
      >
        Redirigiendo a la app… (modo dev)
      </div>
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 24,
        padding: 32,
        textAlign: "center",
      }}
    >
      <Logo size={48} variant="wordmark" />
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.5px",
          margin: 0,
        }}
      >
        Iniciar sesión
      </h1>
      <p
        style={{
          color: "var(--color-text-mid)",
          maxWidth: 420,
          lineHeight: 1.5,
        }}
      >
        Susurra va a integrarse con Clerk para autenticación con email,
        Google y GitHub. Esta pantalla es un placeholder hasta F1.5
        cuando se finalicen las credenciales.
      </p>
      <Button variant="primary" disabled>
        Continuar con Google
      </Button>
      <p
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--color-text-dim)",
          letterSpacing: "0.6px",
          textTransform: "uppercase",
        }}
      >
        Auth mode · {AUTH_MODE}
      </p>
    </main>
  );
}
