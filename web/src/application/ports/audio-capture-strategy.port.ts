// Level-2 Strategy: how audio is captured (tab-share, native SDK, bot service, etc.).

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
