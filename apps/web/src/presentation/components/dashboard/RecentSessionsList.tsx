"use client";

/**
 * RecentSessionsList — list of the user's last 5 sessions.
 *
 * Each row shows title (or "Sesión sin título"), scenario pill, formatted
 * date, duration, and a status pill (Activa = lime, Finalizada = ghost).
 *
 * Click behaviour:
 *   - Active session → /app/live (the live page recovers via
 *     RecoverActiveSessionUseCase when mounted).
 *   - Finished session → /app/live for now (a future detail page can take
 *     over the route /app/sessions/[id] without changing this component).
 *
 * Theme-safe: uses CSS vars + Card primitive (no hard-coded colors except
 * the brand pills which already adapt to dark/light).
 */

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Card, Pill } from "@/design-system/primitives";
import type { Session } from "@/domain/entities/session";
import type { Scenario } from "@/domain/entities/scenario";
import { scenarioColorOf } from "@/domain/entities/scenario";
import {
  fadeUpSubtle,
  staggerContainer,
  transitionFast,
  viewportOnce,
} from "@/lib/motion-presets";

interface RecentSessionsListProps {
  sessions: Session[];
  scenarios: Scenario[];
}

const STATUS_LABEL: Record<Session["status"], string> = {
  active: "Activa",
  ended: "Finalizada",
  abandoned: "Abandonada",
};

function formatStartedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-419", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return `${seconds}s`;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function RecentSessionsList({
  sessions,
  scenarios,
}: RecentSessionsListProps): JSX.Element {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: "visible" as const }
    : {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: viewportOnce,
      };

  const handleClick = (s: Session): void => {
    // Active sessions resume into the live workspace (the live page recovers
    // the in-flight transcripts via RecoverActiveSessionUseCase). Finished
    // sessions open the detail view at /app/sessions/[id].
    if (s.status === "active") {
      router.push("/app/live");
    } else {
      router.push(`/app/sessions/${s.id}`);
    }
  };

  return (
    <section aria-labelledby="recent-sessions-heading">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          margin: "0 0 14px",
        }}
      >
        <h2
          id="recent-sessions-heading"
          style={{
            fontSize: 18,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.2px",
          }}
        >
          Últimas sesiones
        </h2>
        <button
          type="button"
          onClick={() => router.push("/app/sessions")}
          style={{
            all: "unset",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-mid)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Ver todas →
        </button>
      </div>
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
        {sessions.map((s) => {
          const scenarioLabel =
            scenarios.find((sc) => sc.id === s.scenario)?.label ?? s.scenario;
          const duration = formatDuration(s.durationSeconds);
          const statusVariant = s.status === "active" ? "lime" : "ghost";
          return (
            <motion.li
              key={s.id}
              variants={fadeUpSubtle}
              transition={transitionFast}
            >
              <button
                type="button"
                onClick={() => handleClick(s)}
                aria-label={`Abrir sesión: ${s.title ?? "Sesión sin título"}`}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "inherit",
                }}
              >
                <Card>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          margin: "0 0 6px",
                          color: "var(--color-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.title ?? "Sesión sin título"}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          fontSize: 12,
                          color: "var(--color-text-mid)",
                        }}
                      >
                        <Pill variant={scenarioColorOf(s.scenario)}>
                          {scenarioLabel}
                        </Pill>
                        <span aria-hidden="true">·</span>
                        <span>{formatStartedAt(s.startedAt)}</span>
                        {duration ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{duration}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <Pill variant={statusVariant}>
                      {STATUS_LABEL[s.status]}
                    </Pill>
                  </div>
                </Card>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
