/**
 * AudioUplinkWS — `AudioUplinkPort` adapter for the rt_go binary uplink.
 *
 * URL: ws://localhost:8766/audio?session_id={X}&user_id={Y}
 * (rt_go currently ignores query params but accepting them now keeps the
 * door open for multi-tenant routing without an API break.)
 *
 * Auto-reconnect with a fixed 1s delay; the orchestrator hook is in
 * charge of stopping audio capture if the uplink is closed deliberately.
 */

import type {
  AudioUplinkCallbacks,
  AudioUplinkPort,
  WsState,
} from "@/application/ports/audio-uplink.port";

const RECONNECT_DELAY_MS = 1000;

export interface AudioUplinkWSOptions {
  baseUrl?: string;
  sessionId: string;
  userId: string;
  reconnectDelayMs?: number;
}

function buildUrl(opts: AudioUplinkWSOptions): string {
  const base = opts.baseUrl ?? "ws://localhost:8766/audio";
  const qs = new URLSearchParams({
    session_id: opts.sessionId,
    user_id: opts.userId,
  });
  return `${base}?${qs.toString()}`;
}

export class AudioUplinkWS implements AudioUplinkPort {
  private readonly url: string;
  private readonly reconnectDelayMs: number;

  private callbacks: AudioUplinkCallbacks | null = null;
  private ws: WebSocket | null = null;
  private shouldRun = false;
  private currentState: WsState = "closed";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: AudioUplinkWSOptions) {
    this.url = buildUrl(options);
    this.reconnectDelayMs = options.reconnectDelayMs ?? RECONNECT_DELAY_MS;
  }

  state(): WsState {
    return this.currentState;
  }

  async connect(callbacks?: AudioUplinkCallbacks): Promise<void> {
    if (callbacks) this.callbacks = callbacks;
    if (this.shouldRun && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks?.onLog("warn", "AudioUplinkWS.connect called while open; ignoring");
      return;
    }
    this.shouldRun = true;
    await this.openOnce();
  }

  send(buffer: ArrayBuffer): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(buffer);
  }

  close(): void {
    this.shouldRun = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "client stop");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.callbacks?.onLog("warn", `AudioUplinkWS close threw: ${message}`);
      }
      this.ws = null;
      this.setState("closed");
    }
  }

  private openOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState("connecting");
      this.callbacks?.onLog("info", `Audio WS connecting → ${this.url}`);

      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.callbacks?.onLog("error", `Audio WS init error: ${message}`);
        this.setState("error", message);
        this.scheduleReconnect();
        reject(err instanceof Error ? err : new Error(message));
        return;
      }

      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.onopen = () => {
        this.callbacks?.onLog("info", "Audio WS open");
        this.setState("open");
        resolve();
      };

      ws.onclose = (event: CloseEvent) => {
        this.callbacks?.onLog(
          "warn",
          `Audio WS closed (code=${event.code}, reason=${event.reason || "—"})`,
        );
        this.setState("closed", `code=${event.code}`);
        this.ws = null;
        if (this.shouldRun) {
          this.callbacks?.onLog(
            "warn",
            `Audio WS dropped while active; reconnecting in ${this.reconnectDelayMs}ms`,
          );
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        this.callbacks?.onLog("error", "Audio WS error");
        this.setState("error");
      };

      ws.onmessage = (ev: MessageEvent<unknown>) => {
        // Audio path is upstream-only. Log unexpected inbound frames.
        this.callbacks?.onLog("info", `Audio WS recv (ignored): ${typeof ev.data}`);
      };
    });
  }

  private setState(state: WsState, detail?: string): void {
    this.currentState = state;
    this.callbacks?.onStatus(state, detail);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldRun) return;
      this.openOnce().catch(() => {
        // openOnce already logs + schedules another reconnect on init failure.
      });
    }, this.reconnectDelayMs);
  }
}
