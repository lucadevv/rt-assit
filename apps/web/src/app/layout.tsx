import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import { Inter, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShellClient } from "./AppShellClient";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Susurra — Tu copiloto en cualquier conversación",
  description:
    "Asistente IA en tiempo real para entrevistas, reuniones y conversaciones importantes.",
};

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Root layout — owns global font loading + (conditionally) Clerk provider,
 * plus the F9 client shell (Sentry init + global ErrorBoundary +
 * SkipToContent link).
 *
 * AUTH_MODE is read on the server so the ClerkProvider tree is mounted
 * exactly once (or not at all). In dev mode we deliberately do NOT mount
 * Clerk: it would crash without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and
 * the DevAuthAdapter doesn't need any of Clerk's context anyway.
 *
 * The matching client-side branch in `infrastructure/auth/auth-factory.ts`
 * uses the SAME env var, so the chosen adapter and the mounted provider
 * are always in sync.
 *
 * NOTE: Dark mode infrastructure was removed in Camino C — Susurra is a
 * light-only product. Fonts are Inter (sans) + Instrument Serif (italic
 * display accent) to mirror apps/landing.
 */
export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

  const tree = (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <AppShellClient>{children}</AppShellClient>
      </body>
    </html>
  );

  if (authMode === "clerk") {
    return <ClerkProvider>{tree}</ClerkProvider>;
  }
  return tree;
}
