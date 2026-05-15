"use client";

/**
 * FocusTrap — keeps Tab focus inside `children` until ESC / explicit
 * close. Restores focus to the previously-active element on unmount.
 *
 * Notes:
 *  - The trap re-queries focusables on every Tab so dynamic content
 *    (e.g. a list that grows after fetch) is handled correctly.
 *  - ESC dispatches `onEscape` so the container modal can close itself.
 *    We intentionally do NOT swallow Escape if `onEscape` is undefined.
 *  - The wrapper `div` carries `tabIndex={-1}` so we can fall back to
 *    focusing the trap itself when no focusables are inside.
 */

import { useEffect, useRef, type JSX, type ReactNode } from "react";

interface FocusTrapProps {
  children: ReactNode;
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FocusTrap({
  children,
  onEscape,
}: FocusTrapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    const focusFirst = (): void => {
      const focusables = container.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      if (focusables.length === 0) {
        container.focus();
        return;
      }
      focusables[0]?.focus();
    };

    focusFirst();

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = container.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener("keydown", handleKey);
    return () => {
      container.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onEscape]);

  return (
    <div ref={containerRef} tabIndex={-1} style={{ outline: "none" }}>
      {children}
    </div>
  );
}
