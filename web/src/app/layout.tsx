import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/design-system/theme/ThemeProvider";
import { AppShellClient } from "./AppShellClient";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Auri — Tu copiloto en cualquier conversación",
  description:
    "Asistente IA en tiempo real para entrevistas, reuniones y conversaciones importantes.",
};

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Root layout — owns global font loading + theme provider + (conditionally)
 * Clerk provider, plus the F9 client shell (Sentry init + global
 * ErrorBoundary + SkipToContent link).
 *
 * AUTH_MODE is read on the server so the ClerkProvider tree is mounted
 * exactly once (or not at all). In dev mode we deliberately do NOT mount
 * Clerk: it would crash without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and
 * the DevAuthAdapter doesn't need any of Clerk's context anyway.
 *
 * The matching client-side branch in `infrastructure/auth/auth-factory.ts`
 * uses the SAME env var, so the chosen adapter and the mounted provider
 * are always in sync.
 */
export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

  const tree = (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${dmSans.variable} ${jetbrains.variable}`}
    >
      <body>
        <AppShellClient>
          <ThemeProvider>{children}</ThemeProvider>
        </AppShellClient>
      </body>
    </html>
  );

  if (authMode === "clerk") {
    return <ClerkProvider>{tree}</ClerkProvider>;
  }
  return tree;
}
