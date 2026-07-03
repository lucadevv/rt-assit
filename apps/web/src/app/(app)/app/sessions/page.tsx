"use client";

/**
 * Sessions list (/app/sessions) — F10 implementation (Paso 3).
 *
 * Replaces the previous behaviour where session cards on the home dashboard
 * had nowhere to go. This page is a Spanish, Susurra-themed list with:
 *  - title + subtitle
 *  - search input (filters by title, case-insensitive client-side)
 *  - multi-select scenario pills (toggle inclusion)
 *  - single-select date bucket pills (Hoy / Semana / Mes / Todas)
 *  - skeletons during load, empty state when zero results
 *  - cards linking to /app/sessions/[id]
 *
 * The filter state is intentionally LOCAL (no URL plumbing yet). A future
 * iteration can lift these to searchParams for shareable filtered views.
 */

import { useMemo, useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button, Card, Pill, Spinner } from "@/design-system/primitives";
import { useSessionsList } from "@/presentation/hooks/use-sessions-list";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { filterDevFocused } from "@/domain/entities/scenario";
import { SessionsFilterBar } from "@/presentation/components/sessions/SessionsFilterBar";
import { SessionCard } from "@/presentation/components/sessions/SessionCard";
import type { DateBucket } from "@/presentation/components/sessions/SessionsFilterBar";
import type { Session } from "@/domain/entities/session";
import {
  fadeUpSubtle,
  staggerContainer,
  transitionFast,
  viewportOnce,
} from "@/lib/motion-presets";

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketCutoffMs(bucket: DateBucket, nowMs: number): number | null {
  switch (bucket) {
    case "today": {
      const d = new Date(nowMs);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case "week":
      return nowMs - 7 * DAY_MS;
    case "month":
      return nowMs - 30 * DAY_MS;
    case "all":
    default:
      return null;
  }
}

function applyFilters(
  list: Session[],
  query: string,
  scenarios: ReadonlySet<string>,
  bucket: DateBucket,
): Session[] {
  const q = query.trim().toLowerCase();
  const cutoff = bucketCutoffMs(bucket, Date.now());
  return list.filter((s) => {
    if (scenarios.size > 0 && !scenarios.has(s.scenario)) return false;
    if (q.length > 0) {
      const haystack = (s.title ?? "").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (cutoff !== null) {
      const t = new Date(s.startedAt).getTime();
      if (Number.isNaN(t) || t < cutoff) return false;
    }
    return true;
  });
}

function SkeletonCard(): JSX.Element {
  return (
    <Card
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: 16,
        opacity: 0.6,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "var(--color-bg-soft)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            height: 12,
            width: "30%",
            background: "var(--color-bg-soft)",
            borderRadius: 6,
          }}
        />
        <div
          style={{
            height: 16,
            width: "70%",
            background: "var(--color-bg-soft)",
            borderRadius: 6,
          }}
        />
        <div
          style={{
            height: 10,
            width: "40%",
            background: "var(--color-bg-soft)",
            borderRadius: 6,
          }}
        />
      </div>
    </Card>
  );
}

export default function SessionsPage(): JSX.Element {
  const router = useRouter();
  const { sessions, loading, error } = useSessionsList();
  const { available: scenarios } = useScenarios();
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: "visible" as const }
    : {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: viewportOnce,
      };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [dateBucket, setDateBucket] = useState<DateBucket>("all");

  // Phase 4: the filter bar exposes dev-focused scenarios + any legacy
  // scenarios that appear in the user's existing sessions, so they can
  // still filter old data without seeing the full catalog of hidden
  // scenarios.
  const filterScenarios = useMemo(() => {
    const dev = filterDevFocused(scenarios);
    const usedIds = new Set(
      sessions.map((s) => s.scenario).filter((x): x is string => !!x),
    );
    const devIds = new Set(dev.map((s) => s.id));
    const legacyExtras = scenarios.filter(
      (s) => !devIds.has(s.id) && usedIds.has(s.id),
    );
    return [...dev, ...legacyExtras];
  }, [scenarios, sessions]);

  const toggleScenario = (id: string): void => {
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(
    () => applyFilters(sessions, searchQuery, selectedScenarios, dateBucket),
    [sessions, searchQuery, selectedScenarios, dateBucket],
  );

  const goHome = (): void => {
    router.push("/app");
  };

  const goDetail = (id: string): void => {
    router.push(`/app/sessions/${id}`);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1100,
      }}
    >
      <header>
        <Pill variant="ghost">Sesiones</Pill>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "-1.4px",
            margin: "12px 0 8px",
          }}
        >
          Tus <span className="italic-accent">sesiones</span>
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-mid)",
            fontSize: 16,
            lineHeight: 1.5,
            maxWidth: 640,
          }}
        >
          Historial de tus sesiones — buscá, filtrá y abrí cualquiera para ver
          su resumen, transcript y sugerencias.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
            padding: 12,
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <>
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
            <span>Cargando sesiones…</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </>
      ) : sessions.length === 0 ? (
        <Card
          variant="soft"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "flex-start",
            padding: 28,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 16,
              color: "var(--color-text)",
              lineHeight: 1.5,
              maxWidth: 520,
            }}
          >
            Todavía no tenés sesiones. Empezá una desde el inicio para arrancar
            a entrenar con Susurra.
          </p>
          <Button variant="primary" size="md" onClick={goHome}>
            Ir al inicio
          </Button>
        </Card>
      ) : (
        <>
          <SessionsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedScenarios={selectedScenarios}
            onToggleScenario={toggleScenario}
            scenarios={filterScenarios}
            dateBucket={dateBucket}
            onDateBucketChange={setDateBucket}
            total={sessions.length}
            filtered={filtered.length}
          />

          {filtered.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--color-text-mid)",
                padding: "12px 4px",
              }}
            >
              No hay sesiones que coincidan con tu búsqueda. Probá ajustar los
              filtros.
            </p>
          ) : (
            <motion.ul
              variants={staggerContainer(0, 0.06)}
              {...reveal}
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {filtered.map((s) => (
                <motion.li
                  key={s.id}
                  variants={fadeUpSubtle}
                  transition={transitionFast}
                >
                  <SessionCard
                    session={s}
                    scenarios={scenarios}
                    onSelect={goDetail}
                  />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </>
      )}

      {/* Blink animation for the active status pill — scoped via a tiny
          inline <style> so we don't pollute global CSS. */}
      <style>{`
        @keyframes susurra-blink {
          0%, 60% { opacity: 1; }
          80% { opacity: 0.25; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
