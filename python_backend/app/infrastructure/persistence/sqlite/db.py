"""SQLite connection + schema bootstrap.

DB path is configurable via DB_PATH env var. Defaults to /app/data/rtassist.db
(matches docker-compose volume mount). The path is preserved so the existing
DB and its rows survive the refactor."""
import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


DB_PATH = Path(os.getenv("DB_PATH", "/app/data/rtassist.db"))


def _column_exists(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    """Return True iff ``table`` already has ``column``.

    SQLite's ``ALTER TABLE ADD COLUMN`` is NOT idempotent (it raises if the
    column already exists), so we gate it behind a PRAGMA-driven check."""
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def init_db() -> None:
    """Create the schema if it doesn't exist (idempotent).

    Tables created here:
    - documents (existing)
    - users (B0)
    - user_preferences (B0, extended in B4 with audio_device_id)
    - sessions, transcripts, transcripts_fts, hints, speakers,
      session_documents, session_tags (B1)
    - integrations (B4 placeholder)

    Also runs the B0 multi-tenant migration: documents with the legacy
    ``user_id='default'`` literal are migrated to ``'dev_default'`` so they
    align with the dev-mode user created on container start. Idempotent —
    safe to run on every boot."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        # Required for ON DELETE CASCADE to actually fire.
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL DEFAULT 'default',
                doc_type TEXT NOT NULL,
                scenario TEXT,
                title TEXT,
                content TEXT NOT NULL,
                source TEXT,
                metadata TEXT,
                uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
                is_primary INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_user_scenario_type
                ON documents(user_id, scenario, doc_type);

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT,
                avatar_url TEXT,
                tier TEXT NOT NULL DEFAULT 'free',
                language_preferred TEXT NOT NULL DEFAULT 'es-419',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                theme TEXT NOT NULL DEFAULT 'system',
                density TEXT NOT NULL DEFAULT 'comfortable',
                default_layout TEXT NOT NULL DEFAULT 'standalone',
                default_hint_style TEXT NOT NULL DEFAULT 'cards',
                default_transcript_style TEXT NOT NULL DEFAULT 'chat',
                default_scenario TEXT NOT NULL DEFAULT 'interview_dev',
                auto_delete_recordings_days INTEGER,
                keyboard_shortcuts TEXT,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- B1: Sessions ------------------------------------------------
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                scenario TEXT NOT NULL,
                title TEXT,
                my_language TEXT NOT NULL DEFAULT 'es-419',
                other_language TEXT NOT NULL DEFAULT 'en-US',
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                ended_at TEXT,
                duration_seconds INTEGER,
                is_recording INTEGER NOT NULL DEFAULT 0,
                summary TEXT,
                action_items TEXT,
                metadata TEXT,
                deleted_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_user_started
                ON sessions(user_id, started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_sessions_active
                ON sessions(user_id) WHERE ended_at IS NULL AND deleted_at IS NULL;

            -- B1: Speakers (defined BEFORE transcripts because of FK)
            CREATE TABLE IF NOT EXISTS speakers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                deepgram_speaker_id INTEGER NOT NULL,
                label TEXT,
                is_user INTEGER NOT NULL DEFAULT 0,
                UNIQUE(session_id, deepgram_speaker_id)
            );

            -- B1: Transcripts
            CREATE TABLE IF NOT EXISTS transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                speaker_id INTEGER REFERENCES speakers(id),
                deepgram_speaker INTEGER,
                content TEXT NOT NULL,
                is_final INTEGER NOT NULL DEFAULT 0,
                timestamp_ms INTEGER NOT NULL,
                language TEXT,
                confidence REAL
            );
            CREATE INDEX IF NOT EXISTS idx_transcripts_session_time
                ON transcripts(session_id, timestamp_ms);

            -- B1: FTS5 over transcript content (contentless, content-rowid linked)
            CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts
                USING fts5(content, content='transcripts', content_rowid='id');
            CREATE TRIGGER IF NOT EXISTS transcripts_ai AFTER INSERT ON transcripts BEGIN
                INSERT INTO transcripts_fts(rowid, content) VALUES (new.id, new.content);
            END;
            CREATE TRIGGER IF NOT EXISTS transcripts_ad AFTER DELETE ON transcripts BEGIN
                INSERT INTO transcripts_fts(transcripts_fts, rowid, content)
                    VALUES('delete', old.id, old.content);
            END;
            CREATE TRIGGER IF NOT EXISTS transcripts_au AFTER UPDATE ON transcripts BEGIN
                INSERT INTO transcripts_fts(transcripts_fts, rowid, content)
                    VALUES('delete', old.id, old.content);
                INSERT INTO transcripts_fts(rowid, content) VALUES (new.id, new.content);
            END;

            -- B1: Hints
            CREATE TABLE IF NOT EXISTS hints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                related_transcript_id INTEGER REFERENCES transcripts(id),
                content TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_hints_session_time
                ON hints(session_id, timestamp_ms);

            -- B1: Session <-> Document M2M
            CREATE TABLE IF NOT EXISTS session_documents (
                session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
                document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
                PRIMARY KEY (session_id, document_id)
            );

            -- B1: Session tags
            CREATE TABLE IF NOT EXISTS session_tags (
                session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
                tag TEXT NOT NULL,
                PRIMARY KEY (session_id, tag)
            );

            -- B2: Transcript corrections (audit trail) -------------------
            CREATE TABLE IF NOT EXISTS transcript_corrections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transcript_id INTEGER NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                original_content TEXT NOT NULL,
                corrected_content TEXT NOT NULL,
                correction_reason TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_corrections_transcript
                ON transcript_corrections(transcript_id);
            CREATE INDEX IF NOT EXISTS idx_corrections_user
                ON transcript_corrections(user_id);

            -- B4: Integrations placeholder --------------------------------
            -- credentials_encrypted is reserved for future OAuth flows
            -- (F-future) and is NEVER exposed in the domain entity.
            CREATE TABLE IF NOT EXISTS integrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                provider TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'disconnected',
                credentials_encrypted TEXT,
                metadata TEXT,
                connected_at TEXT,
                disconnected_at TEXT,
                UNIQUE(user_id, provider)
            );
            CREATE INDEX IF NOT EXISTS idx_integrations_user
                ON integrations(user_id);

            -- B5: Billing tables ------------------------------------------
            CREATE TABLE IF NOT EXISTS plans (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                price_cents INTEGER NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'USD',
                billing_cycle TEXT NOT NULL DEFAULT 'monthly',
                lemon_squeezy_variant_id TEXT,
                lemon_squeezy_product_id TEXT,
                limits TEXT NOT NULL DEFAULT '{}',
                is_active INTEGER NOT NULL DEFAULT 1,
                is_legacy INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_plans_code_cycle
                ON plans(code, billing_cycle, is_active);

            CREATE TABLE IF NOT EXISTS subscriptions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                plan_id TEXT NOT NULL REFERENCES plans(id),
                status TEXT NOT NULL DEFAULT 'incomplete',
                lemon_squeezy_subscription_id TEXT UNIQUE,
                lemon_squeezy_customer_id TEXT,
                current_period_start TEXT,
                current_period_end TEXT,
                trial_start TEXT,
                trial_end TEXT,
                cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
                canceled_at TEXT,
                payment_failed_at TEXT,
                grace_period_end TEXT,
                dunning_email_count INTEGER NOT NULL DEFAULT 0,
                default_payment_method_id TEXT,
                promo_code_applied TEXT,
                discount_cents INTEGER NOT NULL DEFAULT 0,
                pending_plan_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
                ON subscriptions(user_id, status);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_lemon_id
                ON subscriptions(lemon_squeezy_subscription_id);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end
                ON subscriptions(trial_end) WHERE status = 'trialing';

            CREATE TABLE IF NOT EXISTS payment_methods (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                lemon_squeezy_payment_method_id TEXT,
                type TEXT NOT NULL DEFAULT 'card',
                brand TEXT,
                last_four TEXT,
                exp_month INTEGER,
                exp_year INTEGER,
                is_default INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_payment_methods_user
                ON payment_methods(user_id, is_default);

            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subscription_id TEXT REFERENCES subscriptions(id),
                lemon_squeezy_invoice_id TEXT UNIQUE,
                invoice_number TEXT,
                subtotal_cents INTEGER NOT NULL DEFAULT 0,
                discount_cents INTEGER NOT NULL DEFAULT 0,
                tax_cents INTEGER NOT NULL DEFAULT 0,
                tax_rate REAL NOT NULL DEFAULT 0,
                total_cents INTEGER NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'USD',
                status TEXT NOT NULL DEFAULT 'pending',
                period_start TEXT,
                period_end TEXT,
                issued_at TEXT NOT NULL DEFAULT (datetime('now')),
                paid_at TEXT,
                refunded_at TEXT,
                invoice_pdf_url TEXT,
                refund_amount_cents INTEGER NOT NULL DEFAULT 0,
                refund_reason TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_invoices_user_issued
                ON invoices(user_id, issued_at DESC);

            CREATE TABLE IF NOT EXISTS usage_records (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                period_start TEXT NOT NULL,
                period_end TEXT NOT NULL,
                minutes_used INTEGER NOT NULL DEFAULT 0,
                sessions_count INTEGER NOT NULL DEFAULT 0,
                sessions_completed INTEGER NOT NULL DEFAULT 0,
                docs_count INTEGER NOT NULL DEFAULT 0,
                storage_bytes_used INTEGER NOT NULL DEFAULT 0,
                share_links_created INTEGER NOT NULL DEFAULT 0,
                llm_input_tokens INTEGER NOT NULL DEFAULT 0,
                llm_output_tokens INTEGER NOT NULL DEFAULT 0,
                stt_audio_seconds INTEGER NOT NULL DEFAULT 0,
                cost_cents INTEGER NOT NULL DEFAULT 0,
                limit_hits TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (user_id, period_start)
            );
            CREATE INDEX IF NOT EXISTS idx_usage_user_period
                ON usage_records(user_id, period_start DESC);

            CREATE TABLE IF NOT EXISTS webhook_events (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                signature TEXT,
                status TEXT NOT NULL DEFAULT 'received',
                error_message TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                received_at TEXT NOT NULL DEFAULT (datetime('now')),
                processed_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_webhook_events_status
                ON webhook_events(status, received_at);

            CREATE TABLE IF NOT EXISTS promo_codes (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                description TEXT,
                discount_type TEXT NOT NULL DEFAULT 'percentage',
                discount_value INTEGER NOT NULL DEFAULT 0,
                applicable_plans TEXT NOT NULL DEFAULT '[]',
                max_uses INTEGER,
                max_uses_per_user INTEGER NOT NULL DEFAULT 1,
                valid_from TEXT,
                valid_until TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                times_redeemed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS promo_code_uses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                promo_code_id TEXT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subscription_id TEXT,
                redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_promo_uses_user
                ON promo_code_uses(promo_code_id, user_id);

            CREATE TABLE IF NOT EXISTS billing_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT NOT NULL DEFAULT 'system',
                actor_id TEXT,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_billing_audit_user
                ON billing_audit_log(user_id, created_at DESC);

            -- B6: Recordings (Pro+) ---------------------------------------
            -- 1:1 with sessions: PK = session_id, CASCADE on session delete
            -- so removing a session also drops the recording row (the
            -- audio object on storage is deleted via the use case before
            -- the SQL CASCADE fires; for ad-hoc DB cleanup the storage
            -- object becomes orphan but the cron eventually GC's it via
            -- the bucket-side lifecycle policy in prod).
            CREATE TABLE IF NOT EXISTS recordings (
                session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
                audio_path TEXT NOT NULL,
                audio_format TEXT NOT NULL,
                audio_duration_seconds INTEGER NOT NULL DEFAULT 0,
                audio_size_bytes INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_recordings_expires
                ON recordings(expires_at) WHERE expires_at IS NOT NULL;

            -- B7: Share Links (Premium) -----------------------------------
            -- Short-id PK (12-char URL-safe). Public endpoint resolves
            -- by id (no auth) so we keep id_unique-by-PK and validate
            -- ``revoked_at`` / ``expires_at`` on read. Soft-delete only
            -- (no DELETE) so we keep an audit trail of generated links.
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                permissions TEXT NOT NULL,
                expires_at TEXT,
                revoked_at TEXT,
                view_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_share_links_session
                ON share_links(session_id);
            CREATE INDEX IF NOT EXISTS idx_share_links_user
                ON share_links(user_id, created_at DESC);

            -- B8: Cross-cutting concerns ---------------------------------

            -- Notifications (in-app + email).
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                channel TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                metadata TEXT,
                read_at TEXT,
                sent_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
                ON notifications(user_id, read_at);
            CREATE INDEX IF NOT EXISTS idx_notifications_user_created
                ON notifications(user_id, created_at DESC);

            -- Email templates (DB-stored; replaces hardcoded B5 templates).
            -- Compound PK so the same template can have multiple language
            -- variants (es-419, en-US, …). UNIQUE(id, language).
            CREATE TABLE IF NOT EXISTS email_templates (
                id TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'es-419',
                subject_template TEXT NOT NULL,
                html_template TEXT NOT NULL,
                text_template TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (id, language)
            );

            -- Background jobs (tracking).
            CREATE TABLE IF NOT EXISTS background_jobs (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 3,
                error TEXT,
                scheduled_at TEXT,
                started_at TEXT,
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled
                ON background_jobs(status, scheduled_at);
            CREATE INDEX IF NOT EXISTS idx_jobs_type_status
                ON background_jobs(type, status);

            -- API keys (BYOK; AES-256-GCM ciphertext).
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                provider TEXT NOT NULL,
                key_encrypted TEXT NOT NULL,
                key_hint TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                last_used_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, provider)
            );
            CREATE INDEX IF NOT EXISTS idx_api_keys_user
                ON api_keys(user_id);

            -- H1: Personas (user-level switchable identities) --------------
            -- Each persona links to N documents via persona_documents.
            -- Invariant: at most one persona per user has is_default=1 —
            -- enforced transactionally inside SQLitePersonasRepository's
            -- create()/set_default() (no DB constraint because SQLite
            -- doesn't support partial unique indexes that combine well
            -- with the multi-tenant scoping we need here).
            CREATE TABLE IF NOT EXISTS personas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT,
                scenario_id TEXT,
                icon TEXT,
                tone TEXT,
                custom_instructions TEXT,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_personas_user
                ON personas(user_id);
            CREATE INDEX IF NOT EXISTS idx_personas_user_default
                ON personas(user_id, is_default);

            -- H1: persona_documents M2M ----------------------------------
            -- ``is_identity`` distinguishes identity docs (CV-equivalent)
            -- from knowledge-base reference docs. Composite PK plus the
            -- per-FK indexes accelerate both directions of the join.
            CREATE TABLE IF NOT EXISTS persona_documents (
                persona_id INTEGER NOT NULL
                    REFERENCES personas(id) ON DELETE CASCADE,
                document_id INTEGER NOT NULL
                    REFERENCES documents(id) ON DELETE CASCADE,
                is_identity INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (persona_id, document_id)
            );
            CREATE INDEX IF NOT EXISTS idx_persona_documents_persona
                ON persona_documents(persona_id);
            CREATE INDEX IF NOT EXISTS idx_persona_documents_doc
                ON persona_documents(document_id);

            -- H1: session_materials (ad-hoc per-session content) ---------
            -- Brief, agenda, objective, link, note, file. Cascade-deletes
            -- with the parent session row.
            CREATE TABLE IF NOT EXISTS session_materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL
                    REFERENCES sessions(id) ON DELETE CASCADE,
                material_type TEXT NOT NULL,
                title TEXT,
                content TEXT,
                source_url TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_session_materials_session
                ON session_materials(session_id);

            -- Meeting Frame foundation: OAuth credentials ----------------
            -- Per-user OAuth tokens (Meet/Teams/Zoom). access_token and
            -- refresh_token are stored as Fernet-encrypted BLOBs; the
            -- repository owns key handling. UNIQUE(user_id, provider) so
            -- INSERT ... ON CONFLICT upserts cleanly.
            CREATE TABLE IF NOT EXISTS oauth_credentials (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                access_token_enc BLOB NOT NULL,
                refresh_token_enc BLOB NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(user_id, provider)
            );
            CREATE INDEX IF NOT EXISTS idx_oauth_user_provider
                ON oauth_credentials(user_id, provider);

            -- Meeting Frame Sprint 1+: persisted meetings ------------------
            -- Provider-agnostic. ``provider_meeting_id`` stores the
            -- provider's native identifier (e.g. "spaces/abc123" for
            -- Google Meet) so we can later operate on the meeting via the
            -- provider API without parsing ``join_url``.
            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                join_url TEXT NOT NULL,
                provider_meeting_id TEXT NOT NULL,
                title TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_meetings_user
                ON meetings(user_id, created_at DESC);
            """
        )

        # B5 — seed plans (idempotent INSERT OR IGNORE)
        _seed_plans(conn)

        # B8 — seed email templates (idempotent INSERT OR IGNORE)
        _seed_email_templates(conn)

        # B4 migration (idempotent): add audio_device_id column to
        # user_preferences if it doesn't exist yet. SQLite's ALTER TABLE
        # ADD COLUMN raises if the column already exists, so PRAGMA-gate
        # it for safe re-runs.
        cursor = conn.cursor()
        if not _column_exists(cursor, "user_preferences", "audio_device_id"):
            cursor.execute(
                "ALTER TABLE user_preferences ADD COLUMN audio_device_id TEXT"
            )

        # Wave 2A migration (idempotent): add is_primary column to documents
        # so the frontend Principal-toggle (⭐) can flag the canonical identity
        # doc per (user, scenario). Stored as INTEGER (0/1) — SQLite has no
        # native boolean type. Default 0 so all existing rows are non-primary.
        if not _column_exists(cursor, "documents", "is_primary"):
            cursor.execute(
                "ALTER TABLE documents ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0"
            )

        # Session-mode migration (idempotent): add ``mode`` column to
        # sessions. NULL-safe via NOT NULL DEFAULT 'agent' so every
        # pre-existing row falls back to the original 1st-person agent
        # behaviour. The orthogonal scribe mode is opted-in per-session
        # via the create-session API.
        if not _column_exists(cursor, "sessions", "mode"):
            cursor.execute(
                "ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'agent'"
            )

        # B0 migration (idempotent): seed dev_default user + remap legacy
        # documents.user_id='default' -> 'dev_default'.
        conn.execute(
            """INSERT OR IGNORE INTO users
               (id, email, name, avatar_url, tier, language_preferred)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                "dev_default",
                "dev@susurra.local",
                "Dev User",
                None,
                "free",
                "es-419",
            ),
        )
        conn.execute(
            "UPDATE documents SET user_id = 'dev_default' WHERE user_id = 'default'"
        )
        conn.commit()


# ---------------------------------------------------------------------------
# B5 — Plan catalog seeds
# ---------------------------------------------------------------------------


FREE_LIMITS: dict = {
    "max_session_duration_minutes": 30,
    "max_minutes_per_month": None,
    "max_docs": 5,
    "max_recordings": 0,
    "max_storage_gb": 0,
    "max_share_links": 0,
    "max_custom_scenarios": 0,
    "diarization_enabled": False,
    "voice_fingerprinting_enabled": False,
    "tweaks_layouts_unlocked": ["standalone"],
    "tweaks_hint_styles_unlocked": ["cards"],
    "tweaks_transcript_styles_unlocked": ["chat"],
    "byok_enabled": False,
    "priority_support": False,
    "export_formats": ["txt", "md"],
    "stealth_mode": False,
}

PRO_LIMITS: dict = {
    "max_session_duration_minutes": None,
    "max_minutes_per_month": None,
    "max_docs": None,
    "max_recordings": None,
    "max_storage_gb": 5,
    "max_share_links": 10,
    "max_custom_scenarios": 5,
    "diarization_enabled": True,
    "voice_fingerprinting_enabled": False,
    "tweaks_layouts_unlocked": ["standalone", "pip", "sidebar"],
    "tweaks_hint_styles_unlocked": ["cards", "chat", "sidebar"],
    "tweaks_transcript_styles_unlocked": ["chat", "doc", "karaoke"],
    "byok_enabled": False,
    "priority_support": True,
    "export_formats": ["txt", "md", "pdf"],
    "stealth_mode": False,
}

PREMIUM_LIMITS: dict = {
    **PRO_LIMITS,
    "max_storage_gb": 50,
    "max_share_links": None,
    "max_custom_scenarios": None,
    "voice_fingerprinting_enabled": True,
    "stealth_mode": True,
}

BYOK_LIMITS: dict = {
    **PRO_LIMITS,
    "byok_enabled": True,
    "max_minutes_per_month": None,
}


def _seed_plans(conn: sqlite3.Connection) -> None:
    """Idempotently seed the plan catalog. INSERT OR IGNORE preserves any
    LS variant ids that have already been wired up by the operator."""
    plans = [
        # (id, code, name, description, price_cents, currency, billing_cycle,
        #  ls_variant_id, ls_product_id, limits_json, is_active, is_legacy, sort_order)
        (
            "free",
            "free",
            "Free",
            "Para probar la plataforma sin tarjeta.",
            0,
            "USD",
            "free",
            None,
            None,
            json.dumps(FREE_LIMITS),
            1,
            0,
            1,
        ),
        (
            "pro_monthly",
            "pro",
            "Pro · Mensual",
            "Sesiones ilimitadas, 5 GB storage, diarización.",
            1200,
            "USD",
            "monthly",
            None,
            None,
            json.dumps(PRO_LIMITS),
            1,
            0,
            2,
        ),
        (
            "pro_yearly",
            "pro",
            "Pro · Anual (-17%)",
            "Pro con descuento anual.",
            12000,
            "USD",
            "yearly",
            None,
            None,
            json.dumps(PRO_LIMITS),
            1,
            0,
            3,
        ),
        (
            "premium_monthly",
            "premium",
            "Premium · Mensual",
            "Todo lo de Pro + voice fingerprint + stealth mode + 50 GB.",
            2900,
            "USD",
            "monthly",
            None,
            None,
            json.dumps(PREMIUM_LIMITS),
            1,
            0,
            4,
        ),
        (
            "premium_yearly",
            "premium",
            "Premium · Anual (-17%)",
            "Premium con descuento anual.",
            29000,
            "USD",
            "yearly",
            None,
            None,
            json.dumps(PREMIUM_LIMITS),
            1,
            0,
            5,
        ),
        (
            "byok",
            "byok",
            "BYOK",
            "Trae tus propias keys de LLM/STT — paga sólo la plataforma.",
            500,
            "USD",
            "monthly",
            None,
            None,
            json.dumps(BYOK_LIMITS),
            1,
            0,
            6,
        ),
    ]
    cur = conn.cursor()
    cur.executemany(
        """INSERT OR IGNORE INTO plans
           (id, code, name, description, price_cents, currency, billing_cycle,
            lemon_squeezy_variant_id, lemon_squeezy_product_id, limits,
            is_active, is_legacy, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   datetime('now'), datetime('now'))""",
        plans,
    )
    conn.commit()


# ---------------------------------------------------------------------------
# B8 — Email template seeds (DB-stored)
# ---------------------------------------------------------------------------


# Mirrors the B5 ``infrastructure/email/templates.py`` content but uses the
# new ``{{var}}`` placeholder syntax (consumed by the
# RenderEmailTemplateUseCase). The B5 fallback renderer using ``{var}``
# stays in place for legacy code paths that still call it directly.
_EMAIL_TEMPLATE_SEEDS: list[tuple[str, str, str, str, str]] = [
    # (id, language, subject, html, text)
    (
        "welcome",
        "es-419",
        "Bienvenido a Susurra",
        (
            "<h1>Hola {{name}}!</h1>"
            "<p>Acabás de empezar tu trial gratis de 14 días en Pro. ¡Disfrutalo!</p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "Hola {{name}}!\n\n"
            "Acabás de empezar tu trial gratis de 14 días en Pro. ¡Disfrutalo!\n\n"
            "— El equipo de Susurra"
        ),
    ),
    (
        "trial_expiring",
        "es-419",
        "Tu trial de Susurra Pro expira pronto",
        (
            "<h1>Hola {{name}}</h1>"
            "<p>Tu trial gratis termina en {{hours_left}} horas. Si querés mantener "
            "acceso a las features Pro, podés suscribirte cuando quieras.</p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "Hola {{name}}\n\n"
            "Tu trial gratis termina en {{hours_left}} horas. Si querés mantener "
            "acceso a las features Pro, podés suscribirte cuando quieras.\n\n"
            "— El equipo de Susurra"
        ),
    ),
    (
        "trial_expiring_24h",
        "es-419",
        "Tu trial de Susurra Pro expira mañana",
        (
            "<h1>Hola {{name}}</h1>"
            "<p>Tu trial gratis termina en menos de 24 horas. "
            "Suscribite para mantener tu acceso Pro sin interrupción.</p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "Hola {{name}}\n\n"
            "Tu trial gratis termina en menos de 24 horas. "
            "Suscribite para mantener tu acceso Pro sin interrupción.\n\n"
            "— El equipo de Susurra"
        ),
    ),
    (
        "invoice_paid",
        "es-419",
        "Recibo de pago — Susurra",
        (
            "<h1>Pago confirmado</h1>"
            "<p>Recibimos tu pago de <strong>{{amount}} {{currency}}</strong>. "
            "Gracias por confiar en Susurra.</p>"
            "<p><a href='{{invoice_url}}'>Ver factura</a></p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "Pago confirmado\n\n"
            "Recibimos tu pago de {{amount}} {{currency}}. Gracias por confiar en Susurra.\n"
            "Factura: {{invoice_url}}\n\n"
            "— El equipo de Susurra"
        ),
    ),
    (
        "payment_failed",
        "es-419",
        "Problema con tu pago — Susurra",
        (
            "<h1>No pudimos procesar tu pago</h1>"
            "<p>Hubo un problema con tu pago. Tenés 7 días para regularizarlo "
            "antes de que la suscripción se desactive.</p>"
            "<p><a href='{{retry_url}}'>Reintentar pago</a></p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "No pudimos procesar tu pago\n\n"
            "Hubo un problema con tu pago. Tenés 7 días para regularizarlo "
            "antes de que la suscripción se desactive.\n"
            "Reintentar: {{retry_url}}\n\n"
            "— El equipo de Susurra"
        ),
    ),
    (
        "dunning",
        "es-419",
        "Recordatorio de pago — Susurra",
        (
            "<h1>Recordatorio de pago (intento {{attempt}})</h1>"
            "<p>Te enviamos este recordatorio porque tu pago aún no fue procesado. "
            "Para mantener tu plan Pro activo, regularizalo lo antes posible.</p>"
            "<p><a href='{{retry_url}}'>Regularizar ahora</a></p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "Recordatorio de pago (intento {{attempt}})\n\n"
            "Te enviamos este recordatorio porque tu pago aún no fue procesado. "
            "Para mantener tu plan Pro activo, regularizalo lo antes posible.\n"
            "Regularizar: {{retry_url}}\n\n"
            "— El equipo de Susurra"
        ),
    ),
    (
        "usage_warning",
        "es-419",
        "Estás cerca del límite de tu plan",
        (
            "<h1>Hola {{name}}</h1>"
            "<p>Llegaste al {{percent}}% de tu límite de "
            "<strong>{{limit_name}}</strong> "
            "para este mes. Si necesitás más, podés pasar a Pro cuando quieras.</p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "Hola {{name}}\n\n"
            "Llegaste al {{percent}}% de tu límite de {{limit_name}} para este mes. "
            "Si necesitás más, podés pasar a Pro cuando quieras.\n\n"
            "— El equipo de Susurra"
        ),
    ),
    (
        "session_summary_ready",
        "es-419",
        "Tu resumen de sesión está listo",
        (
            "<h1>Resumen de sesión disponible</h1>"
            "<p>Hola {{name}}, ya podés ver el resumen + action items "
            "de tu sesión.</p>"
            "<p><a href='{{session_url}}'>Abrir resumen</a></p>"
            "<p>— El equipo de Susurra</p>"
        ),
        (
            "Resumen de sesión disponible\n\n"
            "Hola {{name}}, ya podés ver el resumen + action items de tu sesión.\n"
            "Abrir: {{session_url}}\n\n"
            "— El equipo de Susurra"
        ),
    ),
]


def _seed_email_templates(conn: sqlite3.Connection) -> None:
    """Idempotently seed the email-template catalog. INSERT OR IGNORE
    preserves any operator overrides applied via UPDATE."""
    cur = conn.cursor()
    cur.executemany(
        """INSERT OR IGNORE INTO email_templates
           (id, language, subject_template, html_template, text_template,
            is_active, version, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, 1, datetime('now'))""",
        _EMAIL_TEMPLATE_SEEDS,
    )
    conn.commit()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Foreign keys must be enabled per-connection in SQLite for cascades to work.
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()
