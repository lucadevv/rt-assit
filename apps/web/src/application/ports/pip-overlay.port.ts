/**
 * PipOverlayPort — abstraction over the browser Document Picture-in-Picture
 * API. The application layer (use cases, hooks) MUST consume this port and
 * never the `window.documentPictureInPicture` global directly.
 *
 * The port intentionally hides the concrete `Window` reference; presentation
 * code interacts via the returned `PipOverlayHandle` (close/isOpen) and the
 * adapter exposes the actual PiP `Document` through a side channel only the
 * presentation hook needs (see `getPipDocument` on the handle).
 *
 * Browser support note: only Chromium 116+ exposes
 * `window.documentPictureInPicture`. `isSupported()` MUST return false on
 * Firefox / Safari so the UI can degrade gracefully.
 */

export interface PipOverlayHandle {
  /** Close the PiP window programmatically. Idempotent. */
  close(): void;
  /** True until the user (or `close()`) closes the PiP window. */
  isOpen(): boolean;
  /**
   * The Document object inside the PiP window. The presentation layer needs
   * it to mount a React tree via `createRoot(...)`. Adapter must keep it
   * alive until the window closes.
   */
  getDocument(): Document | null;
  /** The Window object inside the PiP window. */
  getWindow(): Window | null;
}

export interface PipOverlayCallbacks {
  /** Fires once when the PiP window closes (programmatic OR user-driven). */
  onClose: () => void;
}

export interface PipOverlayPort {
  isSupported(): boolean;
  open(callbacks?: PipOverlayCallbacks): Promise<PipOverlayHandle>;
}
