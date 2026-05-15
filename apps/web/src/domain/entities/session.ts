/**
 * Session domain entity — backend `SessionResponse` mirror.
 *
 * Times are kept as ISO strings (UTC, RFC 3339) to keep the domain layer
 * free of `Date` timezone gotchas; presentation parses with the user
 * locale only when rendering.
 *
 * `status` is derived server-side from `endedAt` and soft-delete state —
 * we treat it as authoritative (no client-side override).
 */

export type SessionStatus = "active" | "ended" | "abandoned";

/**
 * SessionMode — picks the prompt-builder branch used by the backend.
 *
 *   - "agent":  Susurra responds in first person ("yo"), as if it were the
 *               user. This is the default behaviour (current pre-mode UX).
 *   - "scribe": Susurra takes structured notes (markdown bullets with the
 *               canonical 📝 🎯 ⚖️ 📅 ❓ topic emojis) while the user
 *               listens. No first-person response — purely note-taking.
 *
 * Old session rows (created before the field existed) default to "agent"
 * at deserialisation time — see SessionsApiAdapter.
 */
export type SessionMode = "agent" | "scribe";

export interface Session {
  id: string;
  userId: string;
  scenario: string;
  title: string | null;
  myLanguage: string;
  otherLanguage: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  isRecording: boolean;
  summary: string | null;
  actionItems: string[];
  status: SessionStatus;
  mode: SessionMode;
  /**
   * Sprint 1.5 — optional FK to a Meeting row. When set, the live UI
   * renders a MeetingInfoCard at the top of /app/live with the join URL
   * and quick actions (Open in Meet / Copy link).
   */
  meetingId: string | null;
  /**
   * Sprint 1.5 — join URL of the associated meeting. Populated by the
   * backend on the SessionDetail response only. ``null`` when no meeting
   * is linked OR when the lookup failed (e.g. the meeting was deleted).
   */
  meetingUrl: string | null;
  /**
   * Sprint 1.5 — human-readable code of the associated meeting (e.g.
   * ``abc-defg-hij`` for Google Meet). Derived backend-side from the URL.
   */
  meetingCode: string | null;
}
