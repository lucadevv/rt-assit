"use client";

/**
 * TopBar — global app header.
 *
 * Layout (left → right):
 *  - Logo (wordmark)
 *  - REC badge (only visible when recording)
 *  - Spacer
 *  - Share button (placeholder action — F7/F8)
 *  - User avatar with dropdown
 *
 * F1 props are minimal — `isRecording` is forwarded so F2 can flip the
 * REC badge once a real session connects. All other chrome is static.
 *
 * NOTE: the scenario pill used to live here, but it was redundant with
 * the Modal Nueva Sesión which already shows the scenario at session
 * start. The pill was removed (Wave 2C) to reduce navbar noise — that
 * also dropped the `ScenarioSelect` component from the codebase.
 */

import type { JSX } from "react";
import { Logo, Button } from "@/design-system/primitives";
import { ShareIcon } from "@/design-system/icons";
import { UserMenu } from "./UserMenu";
import { RecBadge } from "./RecBadge";
import { KbStatusIndicator } from "@/presentation/components/knowledge/KbStatusIndicator";

interface TopBarProps {
  isRecording?: boolean;
}

export function TopBar({ isRecording = false }: TopBarProps): JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 24px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        flexShrink: 0,
        height: 64,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Logo size={32} variant="wordmark" />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
        }}
      >
        <RecBadge isRecording={isRecording} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <KbStatusIndicator />
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ShareIcon size={14} />}
          disabled
          title="Compartir (Premium · disponible en F7)"
        >
          Compartir
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
