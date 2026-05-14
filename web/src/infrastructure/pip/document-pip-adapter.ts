"use client";

/**
 * DocumentPipAdapter — concrete PipOverlayPort over the Chromium
 * `documentPictureInPicture` API.
 *
 * Key responsibilities:
 *   1. Detect support (`isSupported()`) — returns false on Firefox/Safari
 *      and during SSR.
 *   2. Request a PiP window (MUST come from a user gesture — browser
 *      enforces this; presentation hook ensures the call sits inside an
 *      onClick handler).
 *   3. Inject a minimal CSS bundle so the React tree mounted inside has
 *      sane typography + scenario color tokens. We can NOT rely on the
 *      host's stylesheet — the PiP window has its own style scope.
 *   4. Plant a `#auri-pip-root` div and expose its Document/Window so the
 *      presentation hook can `createRoot(rootEl)` against it.
 *   5. Bridge the native `pagehide`/`unload` events into the
 *      `PipOverlayCallbacks.onClose` callback — fires exactly once.
 */

import type {
  PipOverlayCallbacks,
  PipOverlayHandle,
  PipOverlayPort,
} from "@/application/ports/pip-overlay.port";

// Document PiP types are not yet in lib.dom; declare locally.
interface DocumentPictureInPictureRequestOptions {
  width?: number;
  height?: number;
}
interface DocumentPictureInPictureLike {
  requestWindow(
    options?: DocumentPictureInPictureRequestOptions,
  ): Promise<Window>;
  window: Window | null;
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureLike;
  }
}

const PIP_BASE_CSS = `
  :root {
    color-scheme: dark;
    --auri-bg: oklch(13% 0.02 285);
    --auri-bg-soft: oklch(15% 0.022 285);
    --auri-text: oklch(96% 0.01 285);
    --auri-text-mid: oklch(68% 0.02 285);
    --auri-text-dim: oklch(48% 0.02 285);
    --auri-border: oklch(24% 0.04 285);
    --auri-lime: oklch(82% 0.24 130);
    --auri-lime-ink: oklch(22% 0.12 130);
    --auri-cyan: oklch(86% 0.11 205);
    --auri-amber: oklch(82% 0.16 75);
    --auri-lavender: oklch(80% 0.12 295);
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: var(--auri-bg);
    color: var(--auri-text);
    font-family: -apple-system, BlinkMacSystemFont, "DM Sans", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  #auri-pip-root {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: var(--auri-border); border-radius: 3px; }
  button { font-family: inherit; }
`;

const PIP_ROOT_ID = "auri-pip-root";

export class DocumentPipAdapter implements PipOverlayPort {
  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return typeof window.documentPictureInPicture?.requestWindow === "function";
  }

  async open(callbacks?: PipOverlayCallbacks): Promise<PipOverlayHandle> {
    if (!this.isSupported()) {
      throw new Error("Document Picture-in-Picture no soportado en este navegador.");
    }
    const api = window.documentPictureInPicture;
    if (!api) throw new Error("documentPictureInPicture API unavailable");

    const pipWindow = await api.requestWindow({ width: 420, height: 480 });

    // Inject minimal CSS so the React tree inside has sane defaults.
    const style = pipWindow.document.createElement("style");
    style.textContent = PIP_BASE_CSS;
    pipWindow.document.head.appendChild(style);
    pipWindow.document.documentElement.lang = "es";
    pipWindow.document.title = "Auri";

    // Plant the root div for createRoot().
    const root = pipWindow.document.createElement("div");
    root.id = PIP_ROOT_ID;
    pipWindow.document.body.appendChild(root);

    let closed = false;
    const handleClose = (): void => {
      if (closed) return;
      closed = true;
      callbacks?.onClose();
    };

    pipWindow.addEventListener("pagehide", handleClose);
    pipWindow.addEventListener("unload", handleClose);

    return {
      close(): void {
        if (closed) return;
        try {
          pipWindow.close();
        } catch {
          // ignore — will fire pagehide which calls handleClose
        }
        handleClose();
      },
      isOpen(): boolean {
        return !closed;
      },
      getDocument(): Document | null {
        if (closed) return null;
        return pipWindow.document;
      },
      getWindow(): Window | null {
        if (closed) return null;
        return pipWindow;
      },
    };
  }
}
