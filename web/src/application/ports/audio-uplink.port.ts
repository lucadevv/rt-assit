/**
 * AudioUplinkPort — contract for the binary PCM uplink WS to rt_go.
 *
 * One instance per session: the URL embeds session_id + user_id as query
 * params so the rt_go side can route frames per-tenant in the future.
 * Send is binary; the server is upstream-only — any inbound frames are
 * ignored / logged.
 */

export type WsState = "closed" | "connecting" | "open" | "error";

export type AudioUplinkLogLevel = "info" | "warn" | "error";

export interface AudioUplinkCallbacks {
  onStatus(state: WsState, detail?: string): void;
  onLog(level: AudioUplinkLogLevel, message: string): void;
}

export interface AudioUplinkPort {
  connect(callbacks?: AudioUplinkCallbacks): Promise<void>;
  send(buffer: ArrayBuffer): void;
  close(): void;
  state(): WsState;
}
