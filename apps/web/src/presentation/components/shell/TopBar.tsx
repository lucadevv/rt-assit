"use client";

/**
 * TopBar — global app header.
 *
 * Layout (left → right):
 *  - Hamburger button (only visible below 1024px, opens the sidebar overlay)
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
import { Logo } from "@/design-system/primitives";
import { HamburgerIcon } from "@/design-system/icons";
import { UserMenu } from "./UserMenu";
import { RecBadge } from "./RecBadge";
import { KbStatusIndicator } from "@/presentation/components/knowledge/KbStatusIndicator";
import { useIsMobile } from "@/presentation/hooks/use-media-query";
import { useSidebarStore } from "@/application/stores/sidebar.store";

interface TopBarProps {
  isRecording?: boolean;
}

export function TopBar({ isRecording = false }: TopBarProps): JSX.Element {
  const isMobile = useIsMobile();
  const isOpen = useSidebarStore((s) => s.isOpen);
  const openSidebar = useSidebarStore((s) => s.open);

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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {isMobile && (
          <button
            type="button"
            onClick={openSidebar}
            aria-label="Abrir menú de navegación"
            aria-expanded={isOpen}
            aria-controls="sidebar-overlay"
            className="susurra-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--color-text)",
              cursor: "pointer",
              transition: "background-color 120ms ease",
              padding: 0,
            }}
          >
            <HamburgerIcon size={20} />
          </button>
        )}
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
        <UserMenu />
      </div>
    </header>
  );
}
