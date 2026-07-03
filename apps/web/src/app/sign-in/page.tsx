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
 * In custom mode (Fase A+D backend) this is a real email + password form
 * hitting POST /api/auth/login. The backend sets HttpOnly cookies via
 * Set-Cookie; we optimistically seed the auth store from the response body
 * so /app renders without an extra /api/me round-trip on the very next
 * paint. /api/me then refines the user with full domain shape
 * (tier, language, timestamps).
 *
 * In Clerk mode this remains a placeholder until F1.5 wires <SignIn />.
 */

import { useEffect, useState, type FormEvent, type JSX } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button, Input, Logo, Spinner } from "@/design-system/primitives";
import { AUTH_MODE } from "@/infrastructure/auth/auth-factory";
import { useAuthStore } from "@/application/stores/auth.store";
import { easeOut, fadeIn } from "@/lib/motion-presets";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8767";

type FormState = "idle" | "loading" | "error";

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    is_admin: boolean;
  };
}

export default function SignInPage(): JSX.Element {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  if (AUTH_MODE === "clerk") {
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setState("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.status === 401) {
        setState("error");
        setErrorMessage("Email o contraseña incorrectos.");
        return;
      }

      if (res.status === 422) {
        setState("error");
        setErrorMessage("Formato inválido. Verificá tu email.");
        return;
      }

      if (!res.ok) {
        setState("error");
        setErrorMessage("Algo salió mal. Intentá de nuevo en un momento.");
        return;
      }

      // Body still contains access_token + user for backward compat with API
      // clients (curl, CLI). Web frontend ignores access_token; cookies are
      // authoritative. We do a tiny optimistic seed so /app renders without
      // a /api/me round-trip on the very next paint, but the actual auth
      // lives in cookies.
      const data = (await res.json()) as LoginResponse;
      const nowIso = new Date().toISOString();
      useAuthStore.getState().setUser({
        id: data.user.id,
        email: data.user.email,
        name: null,
        avatarUrl: null,
        tier: "free",
        languagePreferred: "es-419",
        createdAt: nowIso,
        updatedAt: nowIso,
        // Optimistic seed — the real is_admin flag is fetched by /api/me
        // on the next paint inside /app. Defaulting to false keeps the
        // founder-only sidebar link hidden until the server confirms.
        isAdmin: false,
      });
      router.replace("/app");
    } catch {
      setState("error");
      setErrorMessage("No pudimos conectar. Verificá tu conexión.");
    }
  }

  const submitDisabled = state === "loading" || !email || !password;

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "32px 24px",
        background: "var(--color-bg)",
      }}
    >
      <motion.div
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.24, ease: easeOut }}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--color-bg-soft)",
          border: "1px solid var(--color-border)",
          borderRadius: 22,
          padding: "40px 32px",
          boxShadow: "var(--shadow-card-2)",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Logo size={40} variant="wordmark" />
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.4px",
              margin: 0,
              color: "var(--color-text)",
            }}
          >
            Iniciar sesión
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-mid)",
              margin: 0,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Beta cerrada por invitación. Si todavía no tenés cuenta, pedí tu
            invitación en la landing.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          noValidate
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            autoComplete="email"
            aria-label="Email"
            disabled={state === "loading"}
            invalid={state === "error"}
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
            autoComplete="current-password"
            aria-label="Contraseña"
            disabled={state === "loading"}
            invalid={state === "error"}
          />

          {errorMessage ? (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: easeOut }}
              role="alert"
              aria-live="polite"
              style={{
                fontSize: 12,
                color: "var(--color-danger)",
                fontWeight: 500,
                lineHeight: 1.45,
              }}
            >
              {errorMessage}
            </motion.div>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            disabled={submitDisabled}
            fullWidth
            style={{ marginTop: 4 }}
          >
            {state === "loading" ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Spinner size={14} color="var(--color-lime-ink)" />
                Ingresando…
              </span>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>

        <p
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--color-text-dim)",
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            textAlign: "center",
            margin: 0,
          }}
        >
          Auth · {AUTH_MODE}
        </p>
      </motion.div>
    </main>
  );
}
