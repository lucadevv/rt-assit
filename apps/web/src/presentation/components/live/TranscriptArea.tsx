"use client";

/**
 * TranscriptArea — switches between the three transcript styles based
 * on the tweaks store.
 */

import type { JSX } from "react";
import { useTweaksStore } from "@/application/stores/tweaks.store";
import { TranscriptChat } from "./transcript-styles/TranscriptChat";
import { TranscriptDoc } from "./transcript-styles/TranscriptDoc";
import { TranscriptKaraoke } from "./transcript-styles/TranscriptKaraoke";

export function TranscriptArea(): JSX.Element {
  const style = useTweaksStore((s) => s.transcriptStyle);
  if (style === "doc") return <TranscriptDoc />;
  if (style === "karaoke") return <TranscriptKaraoke />;
  return <TranscriptChat />;
}
