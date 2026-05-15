/**
 * TranscriptsStreamWS — `TranscriptsStreamPort` adapter.
 *
 * Connects to the rt_go overlay JSON broadcaster (ws://localhost:8765/ws)
 * and emits typed `TranscriptStreamMessage` events to subscribers.
 *
 * Reconnect policy: 1s fixed delay while `shouldRun` is true. The handler
 * set is preserved across reconnects so subscribers don't need to
 * re-subscribe after a transient drop.
 */

import type {
  TranscriptsStreamCallbacks,
  TranscriptsStreamPort,
  TranscriptStreamMessage,
  TranscriptStreamType,
} from "@/application/ports/transcripts-stream.port";
import type { WsState } from "@/application/ports/audio-uplink.port";

const DEFAULT_URL = "ws://localhost:8765/ws";
const RECONNECT_DELAY_MS = 1000;

function isTranscriptType(value: unknown): value is TranscriptStreamType {
  return value === "transcript" || value === "token" || value === "error";
}

function parseMessage(raw: string): TranscriptStreamMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const type = obj["type"];
  const content = obj["content"];
  if (!isTranscriptType(type)) return null;
  if (typeof content !== "string") return null;

  const ms = obj["ms"];
  const isFinal = obj["is_final"];
  const speaker = obj["speaker"];

  return {
    type,
    content,
    ms: typeof ms === "number" ? ms : 0,
    isFinal: isFinal === true,
    speaker: typeof speaker === "number" ? speaker : null,
  };
}

export interface TranscriptsStreamWSOptions {
  url?: string;
  reconnectDelayMs?: number;
}

export class TranscriptsStreamWS implements TranscriptsStreamPort {
  private readonly url: string;
  private readonly reconnectDelayMs: number;
  private readonly handlers = new Set<(msg: TranscriptStreamMessage) => void>();

  private callbacks: TranscriptsStreamCallbacks | null = null;
  private ws: WebSocket | null = null;
  private shouldRun = false;
  private currentState: WsState = "closed";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: TranscriptsStreamWSOptions = {}) {
    this.url = options.url ?? DEFAULT_URL;
    this.reconnectDelayMs = options.reconnectDelayMs ?? RECONNECT_DELAY_MS;
  }

  state(): WsState {
    return this.currentState;
  }

  async connect(callbacks?: TranscriptsStreamCallbacks): Promise<void> {
    if (callbacks) this.callbacks = callbacks;
    if (this.shouldRun && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks?.onLog(
        "warn",
        "TranscriptsStreamWS.connect called while open; ignoring",
      );
      return;
    }
    this.shouldRun = true;
    await this.openOnce();
  }

  onMessage(handler: (msg: TranscriptStreamMessage) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
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
      } catch {
        // ignore
      }
      this.ws = null;
      this.setState("closed");
    }
  }

  private openOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState("connecting");
      this.callbacks?.onLog("info", `Transcripts WS connecting → ${this.url}`);

      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.callbacks?.onLog("error", `Transcripts WS init error: ${message}`);
        this.setState("error", message);
        this.scheduleReconnect();
        reject(err instanceof Error ? err : new Error(message));
        return;
      }

      this.ws = ws;

      ws.onopen = () => {
        this.callbacks?.onLog("info", "Transcripts WS open");
        this.setState("open");
        resolve();
      };

      ws.onclose = (event: CloseEvent) => {
        this.callbacks?.onLog(
          "warn",
          `Transcripts WS closed (code=${event.code}, reason=${event.reason || "—"})`,
        );
        this.setState("closed", `code=${event.code}`);
        this.ws = null;
        if (this.shouldRun) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        this.callbacks?.onLog("error", "Transcripts WS error");
        this.setState("error");
      };

      ws.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (typeof data !== "string") {
          this.callbacks?.onLog(
            "warn",
            `Transcripts WS recv non-string frame (${typeof data})`,
          );
          return;
        }
        const message = parseMessage(data);
        if (!message) {
          this.callbacks?.onLog(
            "warn",
            `Transcripts WS recv invalid JSON: ${data.slice(0, 120)}`,
          );
          return;
        }
        for (const handler of this.handlers) {
          handler(message);
        }
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
      if (this.shouldRun) {
        this.openOnce().catch(() => {
          // already scheduled / logged
        });
      }
    }, this.reconnectDelayMs);
  }
}
