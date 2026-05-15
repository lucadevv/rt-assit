/**
 * SessionsApiPort — REST surface for the Session lifecycle.
 *
 * Backend contract (B1 + B2):
 *   POST   /api/sessions
 *   GET    /api/sessions
 *   GET    /api/sessions/active           — recovery (FR-22)
 *   GET    /api/sessions/{id}             — detail (transcripts + hints + speakers)
 *   PATCH  /api/sessions/{id}
 *   POST   /api/sessions/{id}/end
 *   POST   /api/sessions/{id}/regenerate-summary  — re-run LLM (B2)
 *   DELETE /api/sessions/{id}
 *
 * Request payloads use camelCase (the adapter maps to snake_case).
 */

import type { Session, SessionMode } from "@/domain/entities/session";
import type { Transcript } from "@/domain/entities/transcript";
import type { Hint } from "@/domain/entities/hint";
import type { Speaker } from "@/domain/entities/speaker";

export interface CreateSessionInput {
  scenario: string;
  myLanguage: string;
  otherLanguage: string;
  isRecording: boolean;
  title?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Optional list of Document IDs the user explicitly selected for this
   * session. Threaded into `metadata.document_ids` by the adapter so the
   * backend can pick them up once it supports per-session document
   * scoping (Wave 2A+). Old backends ignore the metadata bag silently.
   */
  documentIds?: readonly number[];
  /**
   * Selects the prompt-builder branch used by the backend agent. Omit to
   * fall back to the backend's default ("agent"). Stays one word so the
   * camel → snake mapping is identity (`mode`).
   */
  mode?: SessionMode;
  /**
   * Sprint 1.5 — optional id of a previously-created Meeting row. The
   * adapter forwards this as `meeting_id` (snake) and the backend verifies
   * ownership before persisting the FK.
   */
  meetingId?: string | null;
}

export interface SessionDetail {
  session: Session;
  transcripts: Transcript[];
  hints: Hint[];
  speakers: Speaker[];
  tags: string[];
}

export interface SessionsApiPort {
  create(input: CreateSessionInput): Promise<Session>;
  list(params?: {
    scenario?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Session[]>;
  active(): Promise<Session | null>;
  detail(sessionId: string): Promise<SessionDetail>;
  end(sessionId: string): Promise<Session>;
  /**
   * Triggers an LLM-based summary regeneration in the background.
   * Returns the current Session row (summary may still be the old value
   * — F8 polls `detail()` afterwards to observe the new summary appearing).
   */
  regenerateSummary(sessionId: string): Promise<Session>;
  delete(sessionId: string): Promise<boolean>;
}
