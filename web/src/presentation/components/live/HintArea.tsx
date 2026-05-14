"use client";

/**
 * HintArea — switches between the three hint styles based on the tweaks
 * store.
 */

import type { JSX } from "react";
import { useTweaksStore } from "@/application/stores/tweaks.store";
import { HintCards } from "./hint-styles/HintCards";
import { HintChat } from "./hint-styles/HintChat";
import { HintSidebar } from "./hint-styles/HintSidebar";

export function HintArea(): JSX.Element {
  const style = useTweaksStore((s) => s.hintStyle);
  if (style === "chat") return <HintChat />;
  if (style === "sidebar") return <HintSidebar />;
  return <HintCards />;
}
