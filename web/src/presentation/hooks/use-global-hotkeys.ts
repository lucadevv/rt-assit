"use client";

/**
 * useGlobalHotkeys — page-level keyboard shortcuts for the live screen.
 *
 * Bindings:
 *   - Cmd+Shift+H  (Mac) / Ctrl+Shift+H  (Win/Linux)
 *       → toggle the `isHidden` peek-dim flag in the tweaks store.
 *         "Peek mode" — the PiP / Sidebar layouts drop to opacity ~0.1
 *         instead of full hide so the user still sees a faint reminder
 *         that Auri is there.
 *   - Cmd+Shift+P  (Mac) / Ctrl+Shift+P  (Win/Linux)
 *       → dispatch a global `auri:force-regenerate` CustomEvent on
 *         `window`. `useLiveSession` (mounted on /app/live) listens for
 *         it and, if there is a last transcript, re-routes it through
 *         the agent graph for a fresh response. No-op when no live
 *         session is mounted.
 *
 * Collision avoidance:
 *   We intentionally use Cmd+Shift+H and Cmd+Shift+P — both are FREE in
 *   modern Chromium/Firefox/Safari on web pages (Cmd+T new tab,
 *   Cmd+Shift+T reopen tab, Cmd+P print, Cmd+H hide-app at OS level are
 *   what we avoid). Cmd+Shift+H is not a system-reserved combo on macOS
 *   (Cmd+H is hide-app, Cmd+Shift+H jumps to ~/Home in Finder but does
 *   NOT propagate to Chromium tabs). Cmd+Shift+P is the Chromium
 *   "open command menu" only in DevTools — when DevTools isn't focused
 *   the page receives the keydown freely.
 *
 *   We only call `preventDefault()` on the two combos we own — never on
 *   anything else — so system-reserved hotkeys (Cmd+T, Cmd+W, F12) keep
 *   working exactly as the user expects.
 *
 * Ignored when focus is in an editable surface:
 *   The hook bails when `document.activeElement` is an <input>,
 *   <textarea>, contenteditable=true, or inside the `[role="textbox"]`.
 *   This prevents weird collisions while the user is renaming a speaker
 *   or filling the new-session form.
 *
 * Lifecycle:
 *   Mounted at the top of /app/live (page.tsx). Unmounting the page
 *   removes the listener.
 */

import { useEffect } from "react";
import { useTweaksStore } from "@/application/stores/tweaks.store";

/** Custom event name fired when the user wants to force a regenerate. */
export const FORCE_REGENERATE_EVENT = "auri:force-regenerate";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  const role = target.getAttribute("role");
  if (role === "textbox" || role === "combobox") return true;
  return false;
}

/**
 * Detect "command modifier" (Cmd on Mac, Ctrl on Win/Linux). We allow
 * either so users don't have to remember which platform they're on.
 *
 * IMPORTANT: we require `event.shiftKey` to be true and `event.altKey`
 * to be false — this distinguishes our chord from accidental system
 * combos like Ctrl+H (history) which uses NO shift.
 */
function isCommandShift(event: KeyboardEvent): boolean {
  if (!event.shiftKey) return false;
  if (event.altKey) return false;
  return event.metaKey || event.ctrlKey;
}

/**
 * Normalise the pressed letter regardless of the OS keymap. `event.code`
 * is the physical key (e.g. "KeyH") and stays stable across QWERTY/AZERTY.
 * We accept either `code === "KeyH"` or `key.toLowerCase() === "h"` so
 * remapped keyboards still match.
 */
function matchesKey(event: KeyboardEvent, letter: string): boolean {
  const upper = letter.toUpperCase();
  if (event.code === `Key${upper}`) return true;
  return event.key.toLowerCase() === letter.toLowerCase();
}

export function useGlobalHotkeys(): void {
  const toggleHidden = useTweaksStore((s) => s.toggleHidden);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // Skip when the user is typing somewhere — the hotkey should never
      // hijack text input.
      if (isEditableTarget(event.target)) return;
      if (!isCommandShift(event)) return;

      if (matchesKey(event, "h")) {
        event.preventDefault();
        toggleHidden();
        return;
      }

      if (matchesKey(event, "p")) {
        event.preventDefault();
        // Broadcast — useLiveSession owns the actual regenerate logic
        // (which, today, is best-effort given the agent stream is
        // receive-only; it logs + tracks but cannot re-trigger a new
        // LLM call without backend support). Wiring the event now means
        // the day backend gains a force-regen frame we only have to
        // touch one place.
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(FORCE_REGENERATE_EVENT));
        }
        return;
      }
    };

    if (typeof window === "undefined") return;
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleHidden]);
}
