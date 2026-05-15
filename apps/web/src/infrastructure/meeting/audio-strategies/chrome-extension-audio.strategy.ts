/**
 * ChromeExtensionAudioStrategy — Sprint 2 of meeting-frame.
 *
 * NOT YET IMPLEMENTED. This is a placeholder so the file structure makes
 * the planned architecture obvious.
 *
 * When built, this strategy will:
 *   - Listen for `window.postMessage` events from the Susurra Chrome
 *     extension (or chrome.runtime.connect via content script).
 *   - The extension uses tabCapture/getMediaStream APIs to grab tab audio
 *     without `getDisplayMedia` (zero user friction).
 *   - PCM frames flow: extension → content script → window.postMessage
 *     → this strategy → callbacks.onPCM.
 *
 * The contract is identical to TabShareAudioStrategy from the caller's
 * perspective — that's the whole point of the Strategy Pattern. The DI
 * container switches between strategies behind the AudioCaptureStrategy
 * port; no change is needed in useLiveSession / orchestration.
 *
 * Why a placeholder file (vs. waiting for the implementation):
 *   - Makes the Strategy Pattern visible in the codebase structure.
 *   - Documents the planned integration model in code (not just docs).
 *   - Gives the DI container a real class to import if someone tries to
 *     wire it early — they get a clear "not yet implemented" error instead
 *     of a missing module.
 */

import type {
  AudioCaptureStrategy,
  AudioCaptureCallbacks,
  AudioCaptureStartOptions,
} from "@/application/ports/audio-capture-strategy.port";

export class ChromeExtensionAudioStrategy implements AudioCaptureStrategy {
  readonly name = "chrome-extension";

  isCapturing(): boolean {
    return false;
  }

  getStream(): MediaStream | null {
    return null;
  }

  isPaused(): boolean {
    return false;
  }

  pause(): void {
    // No-op — not implemented.
  }

  resume(): void {
    // No-op — not implemented.
  }

  async start(
    _callbacks: AudioCaptureCallbacks,
    _options?: AudioCaptureStartOptions,
  ): Promise<void> {
    throw new Error(
      "ChromeExtensionAudioStrategy not yet implemented. " +
        "Sprint 2 of meeting-frame will build the Susurra Chrome extension. " +
        "Use TabShareAudioStrategy in the meantime.",
    );
  }

  async stop(): Promise<void> {
    // No-op — not implemented.
  }
}
