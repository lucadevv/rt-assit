// Tab-share strategy: captures audio via getDisplayMedia (the default for all providers until SDK-native audio is wired).

import type {
  AudioCaptureCallbacks,
  AudioCaptureStartOptions,
  AudioCaptureState,
  AudioCaptureStrategy,
} from "@/application/ports/audio-capture-strategy.port";

const TARGET_SAMPLE_RATE = 48000;
const WORKLET_MODULE_URL = "/pcm-processor.js";
const WORKLET_PROCESSOR_NAME = "pcm-processor";

interface PCMWorkletMessage {
  pcm: ArrayBuffer;
}

// getDisplayMedia constraints object accepts Chromium-only hints which
// stock TS DOM lib doesn't recognise. Cast through this loose type to
// avoid lying with `as any` at the call site.
interface DisplayMediaConstraintsExtended extends DisplayMediaStreamOptions {
  selfBrowserSurface?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  preferCurrentTab?: boolean;
}

export class TabShareAudioStrategy implements AudioCaptureStrategy {
  readonly name = "tab-share";
  private callbacks: AudioCaptureCallbacks | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private pcmNode: AudioWorkletNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private framesSent = 0;
  private bytesSent = 0;
  private running = false;
  private paused = false;

  isCapturing(): boolean {
    return this.running;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  isPaused(): boolean {
    return this.paused;
  }

  pause(): void {
    if (!this.running) return;
    if (this.paused) return;
    this.paused = true;
    this.callbacks?.onLog("info", "Capture paused (PCM forwarding gated)");
  }

  resume(): void {
    if (!this.running) return;
    if (!this.paused) return;
    this.paused = false;
    this.callbacks?.onLog("info", "Capture resumed");
  }

  async start(
    callbacks: AudioCaptureCallbacks,
    options: AudioCaptureStartOptions = {},
  ): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(
      `[auri/diag] BrowserAudioCapture.start() called running=${this.running} paused=${this.paused}`,
    );
    if (this.running) {
      // eslint-disable-next-line no-console
      console.warn(
        `[auri/diag] BrowserAudioCapture.start() EARLY-RETURN — already running`,
      );
      callbacks.onLog("warn", "AudioCapture.start called while running; ignoring");
      return;
    }
    this.callbacks = callbacks;
    this.paused = false;
    this.setStatus("requesting");

    const keepVideo = options.keepVideo === true;

    try {
      callbacks.onLog(
        "info",
        `Requesting getDisplayMedia({audio:true, video:true}) keepVideo=${keepVideo}`,
      );
      const constraints: DisplayMediaConstraintsExtended = {
        audio: true,
        video: true,
        selfBrowserSurface: "include",
        systemAudio: "include",
        preferCurrentTab: false,
      };
      // eslint-disable-next-line no-console
      console.info(`[auri/diag] About to call getDisplayMedia`);
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      // eslint-disable-next-line no-console
      console.info(
        `[auri/diag] getDisplayMedia returned tracks=${stream.getTracks().length}`,
      );
      this.stream = stream;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error(
          "El usuario compartió sin audio. Volvé a intentar marcando 'Compartir audio del tab'.",
        );
      }
      callbacks.onLog(
        "info",
        `Audio tracks: ${audioTracks.length}; video tracks: ${stream.getVideoTracks().length}`,
      );

      if (!keepVideo) {
        // Discard video — only audio is needed (PiP / Standalone modes).
        for (const track of stream.getVideoTracks()) {
          track.stop();
          stream.removeTrack(track);
        }
        callbacks.onLog("info", "Video tracks discarded");
      } else {
        callbacks.onLog("info", "Video tracks preserved (sidebar mirror)");
        // If video ends (user stops sharing the tab), tear down the whole
        // session — same UX as audio ending.
        for (const track of stream.getVideoTracks()) {
          track.addEventListener("ended", () => {
            callbacks.onLog("warn", "Video track ended (user stopped sharing)");
            void this.stop();
          });
        }
      }

      const primaryAudio = audioTracks[0];
      if (primaryAudio) {
        primaryAudio.addEventListener("ended", () => {
          callbacks.onLog("warn", "Audio track ended (user stopped sharing)");
          void this.stop();
        });
      }

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      this.audioContext = audioContext;
      callbacks.onLog("info", `AudioContext sampleRate=${audioContext.sampleRate}`);
      callbacks.onFrame(this.framesSent, this.bytesSent, audioContext.sampleRate);

      await audioContext.audioWorklet.addModule(WORKLET_MODULE_URL);
      const pcmNode = new AudioWorkletNode(audioContext, WORKLET_PROCESSOR_NAME);
      this.pcmNode = pcmNode;

      pcmNode.port.onmessage = (event: MessageEvent<PCMWorkletMessage>): void => {
        const buffer = event.data?.pcm;
        if (!buffer) return;
        // While paused, drop the PCM frame entirely — do NOT update
        // counters or call onPCM. Stream stays alive (mirror + meter
        // keep updating via their own subscribers).
        if (this.paused) return;
        this.framesSent += 1;
        this.bytesSent += buffer.byteLength;
        const sr = this.audioContext?.sampleRate ?? 0;
        callbacks.onFrame(this.framesSent, this.bytesSent, sr);
        callbacks.onPCM(buffer);
      };

      const inputSource = audioContext.createMediaStreamSource(stream);
      inputSource.connect(pcmNode);
      this.inputSource = inputSource;
      callbacks.onLog("info", "AudioWorklet wired; emitting PCM Int16 48kHz mono");

      // eslint-disable-next-line no-console
      console.info(`[auri/diag] About to set running=true`);
      this.running = true;
      this.setStatus("running");
      callbacks.onLog("info", "Capture running");

      // Notify late subscribers so they can attach <video>/AnalyserNode.
      try {
        // eslint-disable-next-line no-console
        console.info(`[auri/diag] About to call callbacks.onStream`);
        callbacks.onStream?.(stream);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        callbacks.onLog("warn", `onStream callback threw: ${message}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[auri/diag] BrowserAudioCapture.start() CATCH:`, err);
      const message = err instanceof Error ? err.message : String(err);
      callbacks.onLog("error", `AudioCapture.start error: ${message}`);
      this.setStatus("error", message);
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    // eslint-disable-next-line no-console
    console.warn(
      `[auri/diag] BrowserAudioCapture.stop() called running=${this.running}`,
    );
    this.running = false;
    this.paused = false;

    if (this.pcmNode) {
      try {
        this.pcmNode.port.onmessage = null;
        this.pcmNode.disconnect();
      } catch {
        // ignore disconnect errors
      }
      this.pcmNode = null;
    }

    if (this.inputSource) {
      try {
        this.inputSource.disconnect();
      } catch {
        // ignore
      }
      this.inputSource = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.callbacks?.onLog("warn", `AudioContext close threw: ${message}`);
      }
      this.audioContext = null;
    }

    if (this.stream) {
      // Stop ALL tracks (audio + any video kept for the mirror) — releases
      // GPU + mic permission promptly.
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    this.framesSent = 0;
    this.bytesSent = 0;
    this.callbacks?.onFrame(0, 0, 0);
    this.setStatus("stopped");
    this.callbacks?.onLog("info", "Capture stopped");
    this.callbacks = null;
  }

  private setStatus(state: AudioCaptureState, detail?: string): void {
    this.callbacks?.onStatus(state, detail);
  }
}
