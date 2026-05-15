/**
 * RecordingPlayback — aggregate domain object for the playback view.
 *
 * Bundles the static parts (Session + Recording metadata + transcripts +
 * hints + speakers) with the time-bound `audioUrl` (signed, ~1h TTL).
 * `expiresAt` is the absolute ms-epoch when the URL stops working — the
 * UI can re-fetch via `RecordingsApiPort.getSignedUrl(sessionId)` if the
 * user keeps the page open longer than that.
 *
 * This is a "view aggregate" assembled by `GetRecordingPlaybackUseCase`
 * — the backend exposes the parts via two endpoints (session detail +
 * recording signed URL), and we Promise.all them so the playback view
 * paints in one paint cycle.
 */

import type { Recording } from "./recording";
import type { Session } from "./session";
import type { Transcript } from "./transcript";
import type { Hint } from "./hint";
import type { Speaker } from "./speaker";

export interface RecordingPlayback {
  session: Session;
  recording: Recording;
  /** Signed URL the audio element loads. */
  audioUrl: string;
  /** Absolute ms-epoch when `audioUrl` becomes invalid. */
  audioUrlExpiresAt: number;
  transcripts: Transcript[];
  hints: Hint[];
  speakers: Speaker[];
}
