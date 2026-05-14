/**
 * TranscriptsStreamPort — contract for the rt_go overlay WS that
 * broadcasts Deepgram transcripts as JSON events.
 *
 * Message envelope (matches rt_go overlay):
 *   { type: "transcript" | "token" | "error",
 *     content: string,
 *     ms: number,
 *     is_final: boolean,
 *     speaker?: number }
 *
 * The adapter normalises snake_case → camelCase before delivering the
 * event to subscribers.
 */

import type { WsState, AudioUplinkLogLevel } from "./audio-uplink.port";

export type TranscriptStreamType = "transcript" | "token" | "error";

export interface TranscriptStreamMessage {
  type: TranscriptStreamType;
  content: string;
  ms: number;
  isFinal: boolean;
  speaker: number | null;
}

export interface TranscriptsStreamCallbacks {
  onStatus(state: WsState, detail?: string): void;
  onLog(level: AudioUplinkLogLevel, message: string): void;
}

export interface TranscriptsStreamPort {
  connect(callbacks?: TranscriptsStreamCallbacks): Promise<void>;
  onMessage(handler: (msg: TranscriptStreamMessage) => void): () => void;
  close(): void;
  state(): WsState;
}
