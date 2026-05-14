/**
 * GetRecordingPlaybackUseCase — composite read for the playback view.
 *
 * Combines two independent backend round-trips in parallel:
 *   1. `GET /api/sessions/{id}`      → SessionDetail (B1+B2+B3)
 *   2. `GET /api/sessions/{id}/recording` → SignedAudioUrl (B6)
 *
 * Returns a `RecordingPlayback` aggregate so the UI paints in one cycle
 * after the hook resolves. If the session has no recording, the use
 * case throws — the page boundary catches and renders a "no recording"
 * empty state.
 */

import type { SessionsApiPort } from "@/application/ports/sessions-api.port";
import type { RecordingsApiPort } from "@/application/ports/recordings-api.port";
import type { RecordingPlayback } from "@/domain/entities/recording-playback";

export class GetRecordingPlaybackUseCase {
  constructor(
    private readonly sessions: SessionsApiPort,
    private readonly recordings: RecordingsApiPort,
  ) {}

  async execute(sessionId: string): Promise<RecordingPlayback> {
    const [sessionDetail, recordingMeta, signedUrl] = await Promise.all([
      this.sessions.detail(sessionId),
      this.recordings.get(sessionId),
      this.recordings.getSignedUrl(sessionId),
    ]);

    return {
      session: sessionDetail.session,
      recording: recordingMeta,
      audioUrl: signedUrl.url,
      audioUrlExpiresAt: Date.now() + signedUrl.expiresSeconds * 1000,
      transcripts: sessionDetail.transcripts,
      hints: sessionDetail.hints,
      speakers: sessionDetail.speakers,
    };
  }
}
