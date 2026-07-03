"use client";

/**
 * RecentDocsPreview — bottom strip of the F4 Home dashboard.
 *
 * Shows the 3 most recently uploaded documents from the Knowledge Base.
 * Empty state has a CTA to /app/knowledge to upload a CV (the most common
 * first action). Click on any card → navigates to /app/knowledge so the
 * user can edit/delete from there.
 *
 * Reuses `useDocuments` (F3) so we don't double-fetch.
 */

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Card, Button, Spinner } from "@/design-system/primitives";
import { useDocuments } from "@/presentation/hooks/use-documents";
import { DOC_TYPE_LABELS } from "@/domain/entities/document";
import { ArrowRightIcon } from "@/design-system/icons";
import {
  fadeUpSubtle,
  staggerContainer,
  transitionFast,
  viewportOnce,
} from "@/lib/motion-presets";

const PREVIEW_LIMIT = 3;

export function RecentDocsPreview(): JSX.Element {
  const router = useRouter();
  const { documents, loading } = useDocuments();
  const recent = documents.slice(0, PREVIEW_LIMIT);
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: "visible" as const }
    : {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: viewportOnce,
      };

  return (
    <section aria-labelledby="recent-docs-heading">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "0 0 14px",
        }}
      >
        <h2
          id="recent-docs-heading"
          style={{
            fontSize: 18,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.2px",
          }}
        >
          Tu base de conocimiento
        </h2>
        <Button
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowRightIcon size={14} />}
          onClick={() => router.push("/app/knowledge")}
        >
          Ver todo
        </Button>
      </div>

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
          <Spinner size={16} />
          <span>Cargando documentos…</span>
        </div>
      ) : recent.length === 0 ? (
        <Card>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <p
              style={{
                color: "var(--color-text-mid)",
                fontSize: 14,
                margin: 0,
                maxWidth: 480,
              }}
            >
              Aún no subiste documentos. Subí tu CV para que Susurra te conozca y
              responda mejor en tu nombre.
            </p>
            <Button
              variant="primary"
              onClick={() => router.push("/app/knowledge")}
            >
              Subir CV
            </Button>
          </div>
        </Card>
      ) : (
        <motion.div
          role="list"
          variants={staggerContainer(0, 0.06)}
          {...reveal}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {recent.map((doc) => (
            <motion.button
              key={doc.id}
              type="button"
              role="listitem"
              variants={fadeUpSubtle}
              transition={transitionFast}
              onClick={() => router.push("/app/knowledge")}
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
              aria-label={`Abrir ${doc.title} en la base de conocimiento`}
            >
              <Card>
                <p
                  style={{
                    fontFamily:
                      "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-text-mid)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    margin: "0 0 6px",
                  }}
                >
                  {DOC_TYPE_LABELS[doc.docType]}
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    margin: "0 0 6px",
                    color: "var(--color-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {doc.title}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-mid)",
                    margin: 0,
                  }}
                >
                  {doc.sizeChars.toLocaleString("es-419")} caracteres
                </p>
              </Card>
            </motion.button>
          ))}
        </motion.div>
      )}
    </section>
  );
}
