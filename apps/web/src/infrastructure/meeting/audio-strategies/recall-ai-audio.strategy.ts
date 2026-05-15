/**
 * RecallAiAudioStrategy — premium-tier strategy (planned).
 *
 * NOT YET IMPLEMENTED. This is a placeholder so the Strategy Pattern's
 * shape is visible in the codebase.
 *
 * Integration model (when built):
 *   - The Susurra backend asks Recall.ai (https://www.recall.ai/) to send
 *     a bot to the meeting (Meet / Zoom / Teams).
 *   - The bot joins as a participant and streams the meeting audio to our
 *     ingress over a WebSocket.
 *   - This strategy connects to that WS (`wss://api.susurra.ai/ws/recall/{
 *     sessionId}`) and forwards PCM frames to `callbacks.onPCM`.
 *   - `getStream()` returns null — the bot is the recorder, there's no
 *     local MediaStream to mirror in the UI.
 *
 * Tradeoffs:
 *   - PROS:
 *       · Works without the user being in the meeting.
 *       · Cross-platform (Meet / Zoom / Teams) without per-provider code.
 *       · Survives the user closing their tab.
 *   - CONS:
 *       · Cost per minute (premium tier only).
 *       · Bot appears in participant list (some hosts disable bots).
 *       · Adds a few seconds of join latency.
 *
 * Activation: gated behind `useTierGate('recall_ai_capture')`. The Pill
 * in Settings → Reuniones is locked for Free/Pro users.
 */

import type {
  AudioCaptureStrategy,
  AudioCaptureCallbacks,
  AudioCaptureStartOptions,
} from "@/application/ports/audio-capture-strategy.port";

export class RecallAiAudioStrategy implements AudioCaptureStrategy {
  readonly name = "recall-ai";

  isCapturing(): boolean {
    return false;
  }

  getStream(): MediaStream | null {
    // The bot is the recorder — no local MediaStream to mirror.
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
      "RecallAiAudioStrategy not yet implemented. " +
        "Premium-tier feature — will ship after the Chrome extension. " +
        "Use TabShareAudioStrategy in the meantime.",
    );
  }

  async stop(): Promise<void> {
    // No-op — not implemented.
  }
}
