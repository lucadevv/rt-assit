/**
 * AgentResponse — ephemeral streaming-response state.
 *
 * Lives in `agent.store.ts` while the LLM is generating; once the stream
 * completes we typically commit it as a `Hint` (when the backend persists
 * it). Kept separate from Hint because an in-flight response has no
 * persistent identity and may be cancelled/regenerated.
 */

export interface AgentResponse {
  text: string;
  ms: number;
  isStreaming: boolean;
  isComplete: boolean;
}
