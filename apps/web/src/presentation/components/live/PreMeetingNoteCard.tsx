"use client";

/**
 * PreMeetingNoteCard — surfaces the wizard output during the live session.
 *
 * Renders only when the session has an associated pre-meeting note
 * (fetched via `usePreMeetingNote(sessionId)`). Collapsed by default so
 * the user can focus on the conversation; expandable on click. The two
 * lists keep their original languages (questions in English, checklist
 * in es-LATAM).
 */

import { useState } from "react";
import type { JSX } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { easeOutQuart } from "@/lib/motion-presets";
import { Card, Pill } from "@/design-system/primitives";
import { ChevronDownIcon } from "@/design-system/icons";
import type { PreMeetingNote } from "@/domain/entities/pre-meeting-note";

interface PreMeetingNoteCardProps {
  note: PreMeetingNote;
  /** When true the card starts open. Default: false (collapsed). */
  defaultOpen?: boolean;
}

type Tab = "questions" | "checklist";

export function PreMeetingNoteCard({
  note,
  defaultOpen = false,
}: PreMeetingNoteCardProps): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<Tab>("questions");

  const headerId = `pmn-header-${note.id}`;
  const bodyId = `pmn-body-${note.id}`;

  return (
    <Card
      variant="soft"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: open ? 12 : 0,
        padding: 0,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          padding: "12px 14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--color-text)",
          textAlign: "left",
          fontFamily: "var(--font-inter)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--color-text-mid)",
            }}
          >
            Preparación
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {note.roleTarget} · {note.companyContext}
          </span>
        </div>
        <Pill variant="lavender" uppercase={false}>
          {note.probingQuestions.length + note.prepChecklist.length} ítems
        </Pill>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.18, ease: easeOutQuart }
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "var(--color-text-mid)",
          }}
        >
          <ChevronDownIcon size={16} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={bodyId}
            role="region"
            aria-labelledby={headerId}
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: easeOutQuart }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "0 14px 14px",
              }}
            >
              <div
                role="tablist"
                aria-label="Preparación previa"
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <TabButton
                  selected={tab === "questions"}
                  onClick={() => setTab("questions")}
                  label="Preguntas probables"
                  count={note.probingQuestions.length}
                />
                <TabButton
                  selected={tab === "checklist"}
                  onClick={() => setTab("checklist")}
                  label="Checklist"
                  count={note.prepChecklist.length}
                />
              </div>

              {tab === "questions" ? (
                <NoteList
                  items={note.probingQuestions}
                  emptyHint="No hay preguntas guardadas."
                  mono
                />
              ) : (
                <NoteList
                  items={note.prepChecklist}
                  emptyHint="No hay checklist guardado."
                  mono={false}
                />
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

function TabButton({
  selected,
  onClick,
  label,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  count: number;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      style={{
        appearance: "none",
        cursor: "pointer",
        fontFamily: "var(--font-inter)",
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${selected ? "var(--color-text)" : "var(--color-border)"}`,
        background: selected ? "var(--color-bg)" : "transparent",
        color: "var(--color-text)",
      }}
    >
      {label}
      <span
        style={{
          marginLeft: 6,
          color: "var(--color-text-mid)",
          fontWeight: 500,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function NoteList({
  items,
  emptyHint,
  mono,
}: {
  items: readonly string[];
  emptyHint: string;
  mono: boolean;
}): JSX.Element {
  if (items.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: "var(--color-text-mid)",
        }}
      >
        {emptyHint}
      </p>
    );
  }
  return (
    <ol
      style={{
        margin: 0,
        paddingLeft: 18,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {items.map((item, idx) => (
        <li
          key={`${idx}-${item.slice(0, 24)}`}
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--color-text)",
            fontFamily: mono ? "var(--font-mono)" : "var(--font-inter)",
            fontWeight: mono ? 500 : 400,
          }}
        >
          {item}
        </li>
      ))}
    </ol>
  );
}
