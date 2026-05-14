/**
 * Hint domain entity — backend `HintResponse` mirror.
 *
 * Hints are the agent's persisted suggestions for a given moment in the
 * conversation. They appear AFTER the LLM finishes streaming (when the
 * full content is committed). The streaming response itself lives in the
 * `agent.store.ts` (separate, ephemeral) and only becomes a Hint once the
 * backend confirms persistence over WS.
 */

export interface Hint {
  id?: number;
  sessionId: string;
  relatedTranscriptId: number | null;
  content: string;
  timestampMs: number;
}
