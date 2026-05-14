/**
 * AgentStreamWS — `AgentStreamPort` adapter.
 *
 * URL: ws://localhost:8767/ws/web?token={JWT}&session_id={X}
 *   - In dev AUTH_MODE no token is needed; the backend synthesises
 *     dev_default. We only attach &token=... when the auth port returns
 *     a non-null JWT (Clerk mode).
 *   - 25s ping keepalive (matches backend timeout).
 *   - Auto-reconnect 1s.
 *
 * Event normalisation: snake_case → camelCase happens here so the
 * application layer never deals with backend wire format.
 */

import type {
  AgentEvent,
  AgentStreamCallbacks,
  AgentStreamPort,
  ScreenTextPayload,
} from "@/application/ports/agent-stream.port";
import type { WsState } from "@/application/ports/audio-uplink.port";
import type { Speaker } from "@/domain/entities/speaker";
import type { ScenarioColor } from "@/domain/entities/scenario";

const DEFAULT_BASE_URL = "ws://localhost:8767/ws/web";
const RECONNECT_DELAY_MS = 1000;
const PING_INTERVAL_MS = 25000;

function normaliseColor(raw: unknown): ScenarioColor {
  if (raw === "cyan" || raw === "amber" || raw === "lavender" || raw === "lime") {
    return raw;
  }
  return "lime";
}

function readSpeaker(raw: unknown, fallbackSessionId: string): Speaker | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const id = obj["id"];
  const dgId = obj["deepgram_speaker_id"];
  if (typeof id !== "number" || typeof dgId !== "number") return null;
  return {
    id,
    sessionId:
      typeof obj["session_id"] === "string"
        ? (obj["session_id"] as string)
        : fallbackSessionId,
    deepgramSpeakerId: dgId,
    label: typeof obj["label"] === "string" ? (obj["label"] as string) : null,
    isUser: obj["is_user"] === true,
    colorHint: normaliseColor(obj["color_hint"]),
  };
}

function parseEvent(raw: string): AgentEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj["type"];

  if (type === "connected") {
    return {
      type: "connected",
      message: typeof obj["message"] === "string" ? (obj["message"] as string) : "",
      userId:
        typeof obj["user_id"] === "string" ? (obj["user_id"] as string) : null,
      sessionId:
        typeof obj["session_id"] === "string"
          ? (obj["session_id"] as string)
          : null,
    };
  }
  if (type === "transcript") {
    return {
      type: "transcript",
      content:
        typeof obj["content"] === "string" ? (obj["content"] as string) : "",
      ms: typeof obj["ms"] === "number" ? (obj["ms"] as number) : 0,
      isFinal: obj["is_final"] === true,
      speaker: typeof obj["speaker"] === "number" ? (obj["speaker"] as number) : null,
    };
  }
  if (type === "response" || type === "response_speculative") {
    return {
      type,
      text: typeof obj["text"] === "string" ? (obj["text"] as string) : "",
    };
  }
  if (type === "thinking" || type === "cancelled") {
    return {
      type,
      text: typeof obj["text"] === "string" ? (obj["text"] as string) : "",
    };
  }
  if (type === "listening") return { type: "listening" };
  if (type === "unclear") return { type: "unclear" };
  if (type === "responding") return { type: "responding" };
  if (type === "pong") return { type: "pong" };
  if (type === "error") {
    return {
      type: "error",
      message:
        typeof obj["message"] === "string" ? (obj["message"] as string) : "error",
    };
  }
  if (type === "speaker_label_updated") {
    const sessionId =
      typeof obj["session_id"] === "string" ? (obj["session_id"] as string) : "";
    const speaker = readSpeaker(obj["speaker"], sessionId);
    if (!speaker) return null;
    return { type: "speaker_label_updated", sessionId, speaker };
  }
  if (type === "speakers_merged") {
    const sessionId =
      typeof obj["session_id"] === "string" ? (obj["session_id"] as string) : "";
    const label =
      typeof obj["label"] === "string" ? (obj["label"] as string) : "";
    const dgIdsRaw = obj["deepgram_speaker_ids"];
    const speakersRaw = obj["speakers"];
    const dgIds = Array.isArray(dgIdsRaw)
      ? dgIdsRaw.filter((x): x is number => typeof x === "number")
      : [];
    const speakers = Array.isArray(speakersRaw)
      ? (speakersRaw
          .map((s) => readSpeaker(s, sessionId))
          .filter((s): s is Speaker => s !== null) as readonly Speaker[])
      : [];
    return {
      type: "speakers_merged",
      sessionId,
      label,
      deepgramSpeakerIds: dgIds,
      speakers,
    };
  }
  return null;
}

export interface AgentStreamWSOptions {
  baseUrl?: string;
  sessionId: string;
  getToken?: () => Promise<string | null>;
  reconnectDelayMs?: number;
  pingIntervalMs?: number;
}

export class AgentStreamWS implements AgentStreamPort {
  private readonly baseUrl: string;
  private readonly sessionId: string;
  private readonly getToken: (() => Promise<string | null>) | undefined;
  private readonly reconnectDelayMs: number;
  private readonly pingIntervalMs: number;
  private readonly handlers = new Set<(event: AgentEvent) => void>();

  private callbacks: AgentStreamCallbacks | null = null;
  private ws: WebSocket | null = null;
  private shouldRun = false;
  private currentState: WsState = "closed";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: AgentStreamWSOptions) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.sessionId = options.sessionId;
    this.getToken = options.getToken;
    this.reconnectDelayMs = options.reconnectDelayMs ?? RECONNECT_DELAY_MS;
    this.pingIntervalMs = options.pingIntervalMs ?? PING_INTERVAL_MS;
  }

  state(): WsState {
    return this.currentState;
  }

  async connect(callbacks?: AgentStreamCallbacks): Promise<void> {
    if (callbacks) this.callbacks = callbacks;
    if (this.shouldRun && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks?.onLog(
        "warn",
        "AgentStreamWS.connect called while open; ignoring",
      );
      return;
    }
    this.shouldRun = true;
    await this.openOnce();
  }

  onMessage(handler: (event: AgentEvent) => void): () => void {
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
    this.stopPing();
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

  /**
   * G2 — push an OCR screen-text payload to the backend. Silently
   * no-ops when the socket isn't open (transient reconnect, capture
   * not started yet, etc.). Screen text is best-effort ambient
   * context — a missed payload is fine; another extraction lands in
   * <=5s. NEVER throw from this path or capture will tear down.
   */
  sendScreenText(payload: ScreenTextPayload): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(
        JSON.stringify({
          type: "screen_text",
          text: payload.text,
          confidence: payload.confidence,
          captured_at_ms: payload.capturedAtMs,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.callbacks?.onLog("warn", `Agent WS screen_text send failed: ${message}`);
    }
  }

  private async buildUrl(): Promise<string> {
    const params = new URLSearchParams({ session_id: this.sessionId });
    if (this.getToken) {
      try {
        const token = await this.getToken();
        if (token) params.set("token", token);
      } catch {
        // best-effort — backend may still accept us in dev mode.
      }
    }
    return `${this.baseUrl}?${params.toString()}`;
  }

  private async openOnce(): Promise<void> {
    this.setState("connecting");
    let url: string;
    try {
      url = await this.buildUrl();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.callbacks?.onLog("error", `Agent WS url build error: ${message}`);
      this.setState("error", message);
      this.scheduleReconnect();
      return;
    }

    this.callbacks?.onLog("info", `Agent WS connecting → ${this.baseUrl}`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.callbacks?.onLog("error", `Agent WS init error: ${message}`);
      this.setState("error", message);
      this.scheduleReconnect();
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      this.callbacks?.onLog("info", "Agent WS open");
      this.setState("open");
      this.startPing();
    };

    ws.onclose = (event: CloseEvent) => {
      this.callbacks?.onLog(
        "warn",
        `Agent WS closed (code=${event.code}, reason=${event.reason || "—"})`,
      );
      this.setState("closed", `code=${event.code}`);
      this.ws = null;
      this.stopPing();
      if (this.shouldRun) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      this.callbacks?.onLog("error", "Agent WS error");
      this.setState("error");
    };

    ws.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data !== "string") {
        this.callbacks?.onLog(
          "warn",
          `Agent WS recv non-string frame (${typeof data})`,
        );
        return;
      }
      const evt = parseEvent(data);
      if (!evt) {
        this.callbacks?.onLog(
          "warn",
          `Agent WS recv invalid JSON: ${data.slice(0, 120)}`,
        );
        return;
      }
      for (const handler of this.handlers) {
        handler(evt);
      }
    };
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.callbacks?.onLog("warn", `Agent WS ping failed: ${message}`);
      }
    }, this.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
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
        void this.openOnce();
      }
    }, this.reconnectDelayMs);
  }
}
