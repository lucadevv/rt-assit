/**
 * AudioCaptureStrategy — Level-2 Strategy Pattern.
 *
 * Susurra is a companion to meetings (Meet/Zoom/Teams). It captures the
 * meeting audio and pipes it to rt_go → Deepgram → LLM. HOW the audio is
 * captured is a swappable concern — the high-level orchestration
 * (useLiveSession, pipelines, transcript stream) is identical regardless
 * of the capture mechanism.
 *
 * EXISTING STRATEGIES:
 *   - TabShareAudioStrategy (default, Sprint 1+)
 *       getDisplayMedia → user shares the Meet tab → AudioWorklet → PCM.
 *       Pros: works on any platform, no install, no extra cost.
 *       Cons: user has to share manually every session.
 *
 * PLANNED STRATEGIES (placeholders ready under
 * `infrastructure/meeting/audio-strategies/`):
 *   - ChromeExtensionAudioStrategy (Sprint 2 of meeting-frame)
 *       Chrome extension captures tab audio automatically (Granola pattern).
 *       Pros: zero friction, no manual share.
 *       Cons: requires browser extension install.
 *   - RecallAiAudioStrategy (premium tier)
 *       Recall.ai bot joins the meeting and streams audio via WebSocket.
 *       Pros: works without user being in the meeting; cross-platform.
 *       Cons: cost per minute; bot appears in participant list.
 *   - DesktopAppAudioStrategy (future Electron/Tauri build)
 *       Native app captures OS audio (Cluely pattern).
 *       Pros: works with any video tool (Discord, phone calls, etc.).
 *       Cons: separate distribution per OS.
 *
 * HOW TO ADD A NEW STRATEGY:
 *   1. Create a new file in `infrastructure/meeting/audio-strategies/`
 *      implementing this interface.
 *   2. Wire it in `infrastructure/di/container.ts` (currently hard-coded
 *      to TabShareAudioStrategy — Sprint 2 will add a runtime selector).
 *   3. Add a Pill/toggle in Settings → Reuniones for the user to pick.
 *
 * Lifecycle contract:
 *   - start() must be idempotent (early-return if already running).
 *   - stop() must release ALL resources (streams, contexts, listeners).
 *   - pause/resume must NOT tear down the stream — only gate PCM forwarding.
 *   - isCapturing() reflects state AFTER start() succeeds.
 *   - getStream() returns the active MediaStream for UI mirror; null if
 *     the strategy doesn't have a video component (e.g., RecallAi bot).
 *
 * Callbacks contract:
 *   - onStatus: emit on every state transition (idle/requesting/running/
 *     stopped/error). The orchestrator drives the UI from this signal.
 *   - onPCM: fired for every audio frame (typically 16kHz mono PCM16).
 *     This is the only callback consumed by the audio uplink.
 *   - onFrame: telemetry — frame counter + bytes sent + actual sample rate.
 *     The UI surfaces this in dev panels.
 *   - onLog: structured log forwarded to the analytics + dev console.
 *   - onStream: fired ONCE on successful start, before the first onPCM.
 *     UI components attach `<video>` elements / AnalyserNodes here.
 */


export type AudioCaptureState =
  | "idle"
  | "requesting"
  | "running"
  | "stopped"
  | "error";

export type AudioCaptureLogLevel = "info" | "warn" | "error";

export interface AudioCaptureCallbacks {
  onStatus(state: AudioCaptureState, detail?: string): void;
  onPCM(buffer: ArrayBuffer): void;
  onFrame(framesSent: number, bytesSent: number, sampleRate: number): void;
  onLog(level: AudioCaptureLogLevel, message: string): void;
  /**
   * Fired ONCE when capture starts. Provides the MediaStream so consumers
   * can attach `<video>` elements (video tracks are kept when
   * `keepVideo=true`) and AnalyserNodes (audio tracks).
   */
  onStream?(stream: MediaStream): void;
}

export interface AudioCaptureStartOptions {
  /**
   * Keep video tracks alive instead of discarding them. Required when the
   * UI wants to render a mirror of the captured tab. Costs a bit of GPU.
   * Defaults to `false` (back-compat with PiP / standalone layouts).
   */
  keepVideo?: boolean;
}

export interface AudioCaptureStrategy {
  readonly name: string;
  start(
    callbacks: AudioCaptureCallbacks,
    options?: AudioCaptureStartOptions,
  ): Promise<void>;
  stop(): Promise<void>;
  isCapturing(): boolean;
  isPaused(): boolean;
  pause(): void;
  resume(): void;
  getStream(): MediaStream | null;
}
