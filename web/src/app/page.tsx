"use client";

/**
 * Root `/` — F1 redirects to the protected app shell.
 *
 * Why client-side instead of `redirect()`? In dev mode the auth state is
 * synthesised in the browser (DevAuthAdapter) so the protected layout's
 * own /sign-in fallback only fires after hydration. A client-side
 * `router.replace` keeps the experience identical for both modes and lets
 * the `(app)` layout decide whether to keep the user there or bounce.
 *
 * F4 may replace this with a marketing landing page for unauth visitors.
 */

import { useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/design-system/primitives";

export default function RootPage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app");
  }, [router]);

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
      <span>Redirigiendo…</span>
    </div>
  );
}
