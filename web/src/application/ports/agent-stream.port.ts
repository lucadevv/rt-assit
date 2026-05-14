/**
 * AgentStreamPort — contract for the backend `/ws/web` socket that
 * delivers agent responses, persistence confirmations and speaker
 * label updates.
 *
 * Auth: in `dev` AUTH_MODE no token is needed; the backend synthesises
 * `dev_default`. In `clerk` mode the token must be supplied (Bearer
 * JWT, passed as `?token=...` query param per the cross-cutting WS
 * convention).
 */

import type { Speaker } from "@/domain/entities/speaker";
import type { WsState, AudioUplinkLogLevel } from "./audio-uplink.port";

export type AgentEvent =
  | { type: "connected"; message: string; userId?: string | null; sessionId?: string | null }
  | {
      type: "transcript";
      content: string;
      ms: number;
      isFinal: boolean;
      speaker: number | null;
    }
  | { type: "response"; text: string }
  | { type: "response_speculative"; text: string }
  | { type: "thinking"; text: string }
  | { type: "listening" }
  | { type: "unclear" }
  | { type: "responding" }
  | { type: "cancelled"; text: string }
  | { type: "pong" }
  | { type: "error"; message: string }
  | {
      type: "speaker_label_updated";
      sessionId: string;
      speaker: Speaker;
    }
  | {
      type: "speakers_merged";
      sessionId: string;
      label: string;
      deepgramSpeakerIds: readonly number[];
      speakers: readonly Speaker[];
    };

export interface AgentStreamCallbacks {
  onStatus(state: WsState, detail?: string): void;
  onLog(level: AudioUplinkLogLevel, message: string): void;
}

/**
 * G2 — screen OCR payload pushed from the web client to the backend
 * via the same /ws/web socket the agent stream uses. The backend stores
 * it in the per-session state and threads it into the next prompt build
 * as ambient context. Privacy: only the EXTRACTED text travels, never
 * the raw image — extraction happens in the browser via tesseract.js.
 */
export interface ScreenTextPayload {
  text: string;
  confidence: number;
  capturedAtMs: number;
}

export interface AgentStreamPort {
  connect(callbacks?: AgentStreamCallbacks): Promise<void>;
  onMessage(handler: (event: AgentEvent) => void): () => void;
  close(): void;
  state(): WsState;
  /**
   * Send an OCR screen-text payload to the backend. No-op (does NOT
   * throw) when the socket is closed / reconnecting — screen text is
   * best-effort ambient context and MUST NEVER break the live session.
   */
  sendScreenText(payload: ScreenTextPayload): void;
}
