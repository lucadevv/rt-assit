/**
 * DeleteSessionUseCase — DELETE /api/sessions/{id}.
 *
 * Soft-deletes the entire session (transcripts + hints + recording + tags).
 * Different from `DeleteRecordingUseCase` which only removes the audio.
 */

import type { SessionsApiPort } from "@/application/ports/sessions-api.port";

export class DeleteSessionUseCase {
  constructor(private readonly api: SessionsApiPort) {}

  execute(sessionId: string): Promise<boolean> {
    return this.api.delete(sessionId);
  }
}
