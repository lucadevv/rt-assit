/**
 * ListRecordingsUseCase — wraps `RecordingsApiPort.list`.
 *
 * Pure pass-through: tier gating is enforced at the HOOK boundary
 * (`useRecordings`) via `useTierGate("recordings")`. The use case stays
 * dumb so it can be reused by the future `/shared/...` flow without
 * being entangled with billing state.
 */

import type { RecordingsApiPort } from "@/application/ports/recordings-api.port";
import type { RecordingWithSession } from "@/domain/entities/recording";

export class ListRecordingsUseCase {
  constructor(private readonly api: RecordingsApiPort) {}

  execute(params?: {
    limit?: number;
    offset?: number;
  }): Promise<RecordingWithSession[]> {
    return this.api.list(params);
  }
}
