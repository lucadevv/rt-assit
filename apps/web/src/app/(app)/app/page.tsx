"use client";

/**
 * Home dashboard (/app) — F4 implementation.
 *
 * Composition (top → bottom):
 *   1. HeroBanner — saludo + tier label + CTA "Empezar sesión"
 *   2. EmptyStateBanner (conditional) — sin CV → CTA Subir CV
 *   3. EmptyStateBanner (conditional) — sin escenario activo
 *   4. StatsRow (3 StatCards) o Spinner mientras carga
 *   5. RecentSessionsList o EmptyStateBanner (cuando recent.length === 0)
 *   6. RecentDocsPreview (con su propio empty state interno)
 *
 * Composition root use:
 *  - useCurrentUser → User (con tier para HeroBanner)
 *  - useScenarios → catálogo + escenario actual seleccionado
 *  - useDocuments → hasCv flag (reuse)
 *  - useDashboard → stats + recentSessions (Promise.all)
 *
 * The protected layout `(app)/layout.tsx` already gates auth, so by the
 * time this page renders we have a logged-in user. The `!user` guard is a
 * safety net for the type system (useCurrentUser may return null briefly).
 */

import { useState, type JSX, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCurrentUser } from "@/presentation/hooks/use-current-user";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { useDocuments } from "@/presentation/hooks/use-documents";
import { useDashboard } from "@/presentation/hooks/use-dashboard";
import { Spinner } from "@/design-system/primitives";
import { HeroBanner } from "@/presentation/components/dashboard/HeroBanner";
import { StatsRow } from "@/presentation/components/dashboard/StatsRow";
import { RecentSessionsList } from "@/presentation/components/dashboard/RecentSessionsList";
import { RecentDocsPreview } from "@/presentation/components/dashboard/RecentDocsPreview";
import { EmptyStateBanner } from "@/presentation/components/dashboard/EmptyStateBanner";
import { NewSessionModal } from "@/presentation/components/sessions/NewSessionModal";
import { easeOutQuart } from "@/lib/motion-presets";

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { available: scenarios, current: scenarioId } = useScenarios();
  const { hasCv, hasFetched: docsFetched } = useDocuments();
  const { stats, recentSessions, loading, error } = useDashboard();
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 24,
          color: "var(--color-text-mid)",
          fontSize: 14,
        }}
      >
        <Spinner size={18} />
        <span>Cargando dashboard…</span>
      </div>
    );
  }

  const firstName = (user.name?.trim().split(/\s+/)[0] ?? "che") || "che";

  const recentSessionsEmpty = !loading && recentSessions.length === 0;
  type BannerKey = "cv" | "scenario" | "sessions";
  let primaryBannerKey: BannerKey | null = null;
  let primaryBanner: ReactNode = null;
  if (docsFetched && !hasCv) {
    primaryBannerKey = "cv";
    primaryBanner = (
      <EmptyStateBanner
        variant="amber"
        message="Subí tu CV para que Susurra responda mejor en tu nombre."
        ctaLabel="Subir CV"
        onCta={() => router.push("/app/knowledge")}
      />
    );
  } else if (!scenarioId) {
    primaryBannerKey = "scenario";
    primaryBanner = (
      <EmptyStateBanner
        variant="lavender"
        message="Elegí un escenario activo en la barra superior para personalizar tus sesiones."
        ctaLabel="Entendido"
        onCta={() => {
          /* informational — selector lives in TopBar */
        }}
      />
    );
  } else if (recentSessionsEmpty) {
    primaryBannerKey = "sessions";
    primaryBanner = (
      <EmptyStateBanner
        variant="cyan"
        message="Todavía no tenés sesiones. Iniciá tu primera ahora."
        ctaLabel="Empezar"
        onCta={() => setNewSessionOpen(true)}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1100,
      }}
    >
      <HeroBanner userName={firstName} tier={user.tier} />

      <AnimatePresence mode="wait" initial={false}>
        {primaryBannerKey ? (
          <ProgressiveBannerSlot bannerKey={primaryBannerKey}>
            {primaryBanner}
          </ProgressiveBannerSlot>
        ) : null}
      </AnimatePresence>

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--color-text-mid)",
            fontSize: 14,
          }}
        >
          <Spinner size={18} />
          <span>Calculando estadísticas…</span>
        </div>
      ) : error ? (
        <EmptyStateBanner
          variant="amber"
          message={error}
          ctaLabel="Reintentar"
          onCta={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
        />
      ) : stats ? (
        <StatsRow stats={stats} scenarios={scenarios} />
      ) : null}

      {recentSessions.length > 0 ? (
        <RecentSessionsList sessions={recentSessions} scenarios={scenarios} />
      ) : null}

      <RecentDocsPreview />
      <NewSessionModal
        open={newSessionOpen}
        onClose={() => setNewSessionOpen(false)}
      />
    </div>
  );
}

function ProgressiveBannerSlot({
  bannerKey,
  children,
}: {
  bannerKey: "cv" | "scenario" | "sessions";
  children: ReactNode;
}): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      key={bannerKey}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: easeOutQuart }}
    >
      {children}
    </motion.div>
  );
}
