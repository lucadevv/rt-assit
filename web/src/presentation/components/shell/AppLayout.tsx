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
 * The protected layout (src/app/(app)/layout.tsx) owns auth gating; this
 * component owns visual structure only.
 */

import type { JSX, ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
  isRecording?: boolean;
}

export function AppLayout({
  children,
  isRecording = false,
}: AppLayoutProps): JSX.Element {
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
        }}
      >
        <Sidebar />
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px 40px 64px",
            outline: "none",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
