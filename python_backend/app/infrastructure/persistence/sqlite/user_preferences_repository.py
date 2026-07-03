"""SQLite implementation of UserPreferencesRepository.

B4 — added ``audio_device_id`` (string column, nullable). Update_partial
threads the explicit-NULL semantic via ``audio_device_id_set``: when
True the column is written verbatim (including None which clears the
device); when False the column is left untouched.
"""
import json
import sqlite3
from datetime import datetime
from typing import Any, Optional, cast

from app.application.ports.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.domain.entities.user_preferences import (
    DensityMode,
    HintStyle,
    LayoutMode,
    ThemeMode,
    TranscriptStyle,
    UserPreferences,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteUserPreferencesRepository(UserPreferencesRepository):
    """SQLite-backed user_preferences repository.

    keyboard_shortcuts is stored as JSON-encoded TEXT."""

    def get(self, user_id: str) -> Optional[UserPreferences]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)
            ).fetchone()
        return self._row_to_prefs(row) if row else None

    def upsert(self, prefs: UserPreferences) -> UserPreferences:
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO user_preferences
                   (user_id, theme, density, default_layout, default_hint_style,
                    default_transcript_style, default_scenario,
                    auto_delete_recordings_days, keyboard_shortcuts,
                    audio_device_id, onboarding_complete, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                   ON CONFLICT(user_id) DO UPDATE SET
                       theme = excluded.theme,
                       density = excluded.density,
                       default_layout = excluded.default_layout,
                       default_hint_style = excluded.default_hint_style,
                       default_transcript_style = excluded.default_transcript_style,
                       default_scenario = excluded.default_scenario,
                       auto_delete_recordings_days = excluded.auto_delete_recordings_days,
                       keyboard_shortcuts = excluded.keyboard_shortcuts,
                       audio_device_id = excluded.audio_device_id,
                       onboarding_complete = excluded.onboarding_complete,
                       updated_at = datetime('now')""",
                (
                    prefs.user_id,
                    prefs.theme,
                    prefs.density,
                    prefs.default_layout,
                    prefs.default_hint_style,
                    prefs.default_transcript_style,
                    prefs.default_scenario,
                    prefs.auto_delete_recordings_days,
                    json.dumps(prefs.keyboard_shortcuts or {}),
                    prefs.audio_device_id,
                    1 if prefs.onboarding_complete else 0,
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM user_preferences WHERE user_id = ?",
                (prefs.user_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError(f"failed to upsert prefs for {prefs.user_id}")
        return self._row_to_prefs(row)

    def update_partial(
        self,
        *,
        user_id: str,
        theme: Optional[str] = None,
        density: Optional[str] = None,
        default_layout: Optional[str] = None,
        default_hint_style: Optional[str] = None,
        default_transcript_style: Optional[str] = None,
        default_scenario: Optional[str] = None,
        auto_delete_recordings_days: Optional[int] = None,
        keyboard_shortcuts: Optional[dict[str, Any]] = None,
        audio_device_id: Optional[str] = None,
        audio_device_id_set: bool = False,
        onboarding_complete: Optional[bool] = None,
    ) -> UserPreferences:
        # Ensure a row exists (insert defaults), then patch.
        with get_conn() as conn:
            conn.execute(
                """INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)""",
                (user_id,),
            )

            fields: list[str] = []
            params: list[object] = []
            if theme is not None:
                fields.append("theme = ?")
                params.append(theme)
            if density is not None:
                fields.append("density = ?")
                params.append(density)
            if default_layout is not None:
                fields.append("default_layout = ?")
                params.append(default_layout)
            if default_hint_style is not None:
                fields.append("default_hint_style = ?")
                params.append(default_hint_style)
            if default_transcript_style is not None:
                fields.append("default_transcript_style = ?")
                params.append(default_transcript_style)
            if default_scenario is not None:
                fields.append("default_scenario = ?")
                params.append(default_scenario)
            if auto_delete_recordings_days is not None:
                fields.append("auto_delete_recordings_days = ?")
                params.append(auto_delete_recordings_days)
            if keyboard_shortcuts is not None:
                fields.append("keyboard_shortcuts = ?")
                params.append(json.dumps(keyboard_shortcuts))
            if audio_device_id_set:
                # Explicit set — None means clear the column.
                fields.append("audio_device_id = ?")
                params.append(audio_device_id)
            if onboarding_complete is not None:
                # SQLite has no native bool — store as 0/1 int.
                fields.append("onboarding_complete = ?")
                params.append(1 if onboarding_complete else 0)

            if fields:
                fields.append("updated_at = datetime('now')")
                params.append(user_id)
                conn.execute(
                    f"UPDATE user_preferences SET {', '.join(fields)} WHERE user_id = ?",
                    params,
                )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError(f"prefs row missing for {user_id}")
        return self._row_to_prefs(row)

    def delete(self, user_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM user_preferences WHERE user_id = ?", (user_id,)
            )
            conn.commit()
            return cur.rowcount > 0

    @staticmethod
    def _row_to_prefs(row: sqlite3.Row) -> UserPreferences:
        raw_shortcuts = row["keyboard_shortcuts"]
        shortcuts: dict[str, Any] = (
            json.loads(raw_shortcuts) if raw_shortcuts else {}
        )
        # ``audio_device_id`` was added in B4 — older rows may not have it
        # yet; sqlite3.Row raises IndexError on missing columns so guard.
        try:
            audio_device_id = row["audio_device_id"]
        except (IndexError, KeyError):
            audio_device_id = None
        # ``onboarding_complete`` is post-B4 (first-run wizard) — same
        # defensive read so rows seeded before the migration default to
        # False (the wizard then fires once and flips it).
        try:
            onboarding_raw = row["onboarding_complete"]
        except (IndexError, KeyError):
            onboarding_raw = 0
        onboarding_complete = bool(onboarding_raw or 0)
        return UserPreferences(
            user_id=row["user_id"],
            theme=cast(ThemeMode, row["theme"]),
            density=cast(DensityMode, row["density"]),
            default_layout=cast(LayoutMode, row["default_layout"]),
            default_hint_style=cast(HintStyle, row["default_hint_style"]),
            default_transcript_style=cast(
                TranscriptStyle, row["default_transcript_style"]
            ),
            default_scenario=row["default_scenario"],
            auto_delete_recordings_days=row["auto_delete_recordings_days"],
            keyboard_shortcuts=shortcuts,
            audio_device_id=audio_device_id,
            onboarding_complete=onboarding_complete,
            updated_at=_parse_datetime(row["updated_at"]),
        )


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    normalised = value.replace("T", " ")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return datetime.fromisoformat(value)
