/**
 * DeleteRecordingUseCase — owner-scoped soft delete of a recording.
 *
 * Note: this only removes the AUDIO FILE + recording row. The parent
 * Session is left intact (transcripts/hints/summary stay searchable).
 * Use `DeleteSessionUseCase` (future) to remove the entire session.
 */

import type { RecordingsApiPort } from "@/application/ports/recordings-api.port";

export class DeleteRecordingUseCase {
  constructor(private readonly api: RecordingsApiPort) {}

  execute(sessionId: string): Promise<boolean> {
    return this.api.delete(sessionId);
  }
}
