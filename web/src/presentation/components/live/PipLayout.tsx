"use client";

/**
 * PipLayout — replaces F2's PipLayoutPlaceholder.
 *
 * In-page UI: a control card with the Open/Close PiP overlay button +
 * support fallback messaging, plus a fallback view (StandaloneLayout
 * for `pipMode === "expanded"` or PipCompact for `"compact"`) so the
 * user still sees something useful while the overlay is closed (or
 * unsupported).
 *
 * Tweaks applied here (Cluely-parity quick wins):
 *   - `pipOpacity` — outer container opacity, slider in TweaksPanel.
 *   - `isHidden`   — peek-dim flag toggled via Cmd+Shift+H.
 *     When true we force opacity to 0.1 regardless of the slider, so
 *     the user gets a faint reminder Auri is still there but the layout
 *     is essentially invisible. Pointer events are disabled while
 *     hidden so it doesn't intercept clicks.
 *   - `pipMode`    — `expanded` shows StandaloneLayout fallback,
 *                    `compact` shows PipCompact (last-hint only).
 *   - `pipTheme`   — `auto` (no override) / `dark` (forces dark CSS
 *                    variables on this surface) / `transparent` (rgba
 *                    bg + backdrop-filter blur).
 *
 * The actual floating PiP window is launched from `usePipOverlay()` —
 * its lifecycle is managed there (open/close/unmount). The layout only
 * needs to expose the entry point.
 *
 * Browser caveat: `requestWindow()` MUST be triggered from a user
 * gesture. The `<Button onClick={...}>` satisfies this. Do NOT auto-open.
 */

import type { CSSProperties, JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import { usePipOverlay } from "@/presentation/hooks/use-pip-overlay";
import { useTweaksStore } from "@/application/stores/tweaks.store";
import { StandaloneLayout } from "./StandaloneLayout";
import { PipCompact } from "./PipCompact";

/** Opacity used when the user pressed Cmd+Shift+H (peek-dim mode). */
const PEEK_OPACITY = 0.1;

export function PipLayout(): JSX.Element {
  const { isOpen, isSupported, open, close } = usePipOverlay();
  const pipOpacity = useTweaksStore((s) => s.pipOpacity);
  const isHidden = useTweaksStore((s) => s.isHidden);
  const pipMode = useTweaksStore((s) => s.pipMode);
  const pipTheme = useTweaksStore((s) => s.pipTheme);

  // Resolve the final container opacity: hide-mode wins over the slider
  // so the user can dim instantly without losing their preferred value.
  const effectiveOpacity = isHidden ? PEEK_OPACITY : pipOpacity;

  // Theme styles — applied to the OUTER wrapper so the in-page fallback,
  // the control card AND the compact view inherit the surface treatment.
  const themeStyle: CSSProperties = (() => {
    if (pipTheme === "dark") {
      return {
        background: "oklch(13% 0.02 285)",
        color: "oklch(96% 0.01 285)",
        borderRadius: 16,
        padding: 4,
      };
    }
    if (pipTheme === "transparent") {
      return {
        background: "rgba(0, 0, 0, 0.6)",
        color: "oklch(96% 0.01 285)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 16,
        padding: 4,
      };
    }
    return {};
  })();

  return (
    <div
      data-pip-theme={pipTheme}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity: effectiveOpacity,
        pointerEvents: isHidden ? "none" : "auto",
        transition: "opacity 160ms ease",
        ...themeStyle,
      }}
    >
      <Card
        bordered
        padded
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Pill variant={isOpen ? "lime" : "ghost"}>
              {isOpen ? "Overlay activo" : "Overlay flotante"}
            </Pill>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            Picture-in-Picture
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--color-text-mid)",
              maxWidth: 560,
            }}
          >
            {isSupported
              ? "Auri abre una ventana flotante encima de tu reunión. Funciona con Meet, Zoom, Teams o cualquier app — incluso fullscreen."
              : "Tu navegador no soporta Document Picture-in-Picture. Usá Chrome 116+ o Edge para activarlo."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {isOpen ? (
            <Button variant="ghost" onClick={close}>
              Cerrar overlay
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!isSupported}
              onClick={() => {
                void open();
              }}
            >
              Abrir overlay
            </Button>
          )}
        </div>
      </Card>

      {/* In-page fallback content while the overlay is closed (or whenever
          the user wants a full-page reference). When the overlay is open we
          dim it so the focus is the floating window.

          `pipMode === "compact"` swaps the full StandaloneLayout fallback
          for the trimmed PipCompact view — only last hint + phase chip. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          opacity: isOpen ? 0.55 : 1,
          transition: "opacity 160ms ease",
          pointerEvents: isOpen ? "none" : "auto",
        }}
      >
        {pipMode === "compact" ? <PipCompact /> : <StandaloneLayout />}
      </div>
    </div>
  );
}
