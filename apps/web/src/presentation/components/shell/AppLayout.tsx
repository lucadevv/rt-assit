"use client";

/**
 * AppLayout — outer composition for the protected `(app)` route group.
 *
 * Structure:
 *   ┌────────────── TopBar ──────────────┐
 *   │                                     │
 *   │ Sidebar │ <main> children </main>  │
 *   │                                     │
 *   └─────────────────────────────────────┘
 *
 * Responsive behavior:
 *  - >=1024px: Sidebar renders inline (static, 232px column)
 *  - <1024px:  Sidebar hides; TopBar exposes a hamburger that slides
 *              the sidebar in as an overlay with a dim backdrop.
 *
 * The protected layout (src/app/(app)/layout.tsx) owns auth gating; this
 * component owns visual structure only.
 */

import type { JSX, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/presentation/hooks/use-media-query";
import { useSidebarStore } from "@/application/stores/sidebar.store";
import { easeOutQuart } from "@/lib/motion-presets";

interface AppLayoutProps {
  children: ReactNode;
  isRecording?: boolean;
}

export function AppLayout({
  children,
  isRecording = false,
}: AppLayoutProps): JSX.Element {
  const isMobile = useIsMobile();
  const isOpen = useSidebarStore((s) => s.isOpen);
  const close = useSidebarStore((s) => s.close);
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isMobile && isOpen) {
      close();
    }
  }, [isMobile, isOpen, close]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      <TopBar isRecording={isRecording} />
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {!isMobile && <Sidebar />}

        <AnimatePresence>
          {isMobile && isOpen && (
            <>
              <motion.div
                key="sidebar-backdrop"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onClick={close}
                aria-hidden="true"
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(26, 26, 36, 0.4)",
                  zIndex: 40,
                }}
              />
              <motion.div
                key="sidebar-overlay"
                id="sidebar-overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Menú de navegación"
                initial={shouldReduceMotion ? false : { x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.24, ease: easeOutQuart }}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  zIndex: 50,
                  boxShadow: "0 0 40px -8px rgba(26, 26, 36, 0.18)",
                }}
              >
                <Sidebar onItemClick={close} showCloseButton />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1,
            overflowY: "auto",
            outline: "none",
            minWidth: 0,
          }}
        >
          <div
            style={{
              maxWidth: 1440,
              margin: "0 auto",
              padding:
                "clamp(20px, 3vw, 32px) clamp(20px, 4vw, 48px) clamp(40px, 5vw, 80px)",
              minHeight: "100%",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
