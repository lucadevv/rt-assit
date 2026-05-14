"""UserPreferences domain entity.

Pure data — no framework or infrastructure dependencies. One row per user,
``user_id`` PK references users(id) ON DELETE CASCADE in SQL."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

ThemeMode = Literal["light", "dark", "system"]
DensityMode = Literal["comfortable", "compact"]
LayoutMode = Literal["standalone", "pip", "sidebar"]
HintStyle = Literal["cards", "chat", "sidebar"]
TranscriptStyle = Literal["chat", "doc", "karaoke"]


VALID_THEMES: set[str] = {"light", "dark", "system"}
VALID_DENSITIES: set[str] = {"comfortable", "compact"}
VALID_LAYOUTS: set[str] = {"standalone", "pip", "sidebar"}
VALID_HINT_STYLES: set[str] = {"cards", "chat", "sidebar"}
VALID_TRANSCRIPT_STYLES: set[str] = {"chat", "doc", "karaoke"}


@dataclass
class UserPreferences:
    """Per-user UI/UX preferences (theme, density, defaults).

    B4 — added ``audio_device_id`` for microphone device selection (FR-49).
    """

    user_id: str
    theme: ThemeMode = "system"
    density: DensityMode = "comfortable"
    default_layout: LayoutMode = "standalone"
    default_hint_style: HintStyle = "cards"
    default_transcript_style: TranscriptStyle = "chat"
    default_scenario: str = "interview_dev"
    auto_delete_recordings_days: Optional[int] = None
    keyboard_shortcuts: dict[str, Any] = field(default_factory=dict)
    audio_device_id: Optional[str] = None
    updated_at: Optional[datetime] = None
