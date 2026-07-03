"use client";

/**
 * RecordingsList — vertical stack of RecordingCards.
 *
 * Empty arrays are handled by the page (RecordingsEmptyState) — this
 * component only renders the scrollable list itself.
 */

import type { JSX } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { RecordingWithSession } from "@/domain/entities/recording";
import { RecordingCard } from "./RecordingCard";
import {
  fadeUpSubtle,
  staggerContainer,
  transitionFast,
  viewportOnce,
} from "@/lib/motion-presets";

interface RecordingsListProps {
  recordings: RecordingWithSession[];
  onSelect: (sessionId: string) => void;
}

export function RecordingsList({
  recordings,
  onSelect,
}: RecordingsListProps): JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: "visible" as const }
    : {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: viewportOnce,
      };
  return (
    <motion.div
      role="list"
      variants={staggerContainer(0, 0.06)}
      {...reveal}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {recordings.map((rec) => (
        <motion.div
          role="listitem"
          key={rec.sessionId}
          variants={fadeUpSubtle}
          transition={transitionFast}
        >
          <RecordingCard recording={rec} onSelect={onSelect} />
        </motion.div>
      ))}
    </motion.div>
  );
}
