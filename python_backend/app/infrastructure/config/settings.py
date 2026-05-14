"""Typed application settings loaded from environment variables.

Uses ``pydantic-settings`` (declared in ``pyproject.toml``) for validation
when available, falling back to a plain dataclass that reads ``os.getenv``
so the module imports cleanly in environments where the dependency hasn't
been installed yet (e.g. minimal CI containers).

Google / Microsoft / Zoom credentials are intentionally OPTIONAL — provider
clients raise a typed 503 at invocation time if their credentials are
missing. This lets the backend boot in dev with zero OAuth setup."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal, Optional

logger = logging.getLogger(__name__)

EnvMode = Literal["dev", "prod"]
AuthMode = Literal["dev", "prod"]


def _split_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def _env_optional(key: str) -> Optional[str]:
    raw = os.getenv(key, "").strip()
    return raw or None


# ---------------------------------------------------------------------------
# Try pydantic-settings; if absent, fall back to a dataclass.
# ---------------------------------------------------------------------------

try:
    from pydantic import Field
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        """Pydantic-backed settings — preferred path."""

        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
            case_sensitive=False,
        )

        # Runtime mode -------------------------------------------------------
        env: EnvMode = Field(default="dev", alias="ENV")
        auth_mode: AuthMode = Field(default="dev", alias="AUTH_MODE")
        log_level: str = Field(default="INFO", alias="LOG_LEVEL")

        # Encryption ---------------------------------------------------------
        fernet_key: Optional[str] = Field(default=None, alias="FERNET_KEY")

        # CORS ---------------------------------------------------------------
        cors_allowed_origins_raw: str = Field(
            default="http://localhost:3000", alias="CORS_ALLOWED_ORIGINS"
        )

        # Service tokens -----------------------------------------------------
        rt_go_service_token: Optional[str] = Field(
            default=None, alias="RT_GO_SERVICE_TOKEN"
        )

        # Google OAuth (Sprint 1) -------------------------------------------
        google_client_id: Optional[str] = Field(
            default=None, alias="GOOGLE_CLIENT_ID"
        )
        google_client_secret: Optional[str] = Field(
            default=None, alias="GOOGLE_CLIENT_SECRET"
        )
        google_redirect_uri: str = Field(
            default="http://localhost:8000/api/oauth/google/callback",
            alias="GOOGLE_REDIRECT_URI",
        )

        # Microsoft OAuth (Sprint 2) ----------------------------------------
        microsoft_client_id: Optional[str] = Field(
            default=None, alias="MICROSOFT_CLIENT_ID"
        )
        microsoft_client_secret: Optional[str] = Field(
            default=None, alias="MICROSOFT_CLIENT_SECRET"
        )
        microsoft_tenant_id: str = Field(
            default="common", alias="MICROSOFT_TENANT_ID"
        )
        microsoft_redirect_uri: str = Field(
            default="http://localhost:8000/api/oauth/microsoft/callback",
            alias="MICROSOFT_REDIRECT_URI",
        )
        acs_connection_string: Optional[str] = Field(
            default=None, alias="ACS_CONNECTION_STRING"
        )

        # Zoom OAuth (Sprint 3) ---------------------------------------------
        zoom_client_id: Optional[str] = Field(default=None, alias="ZOOM_CLIENT_ID")
        zoom_client_secret: Optional[str] = Field(
            default=None, alias="ZOOM_CLIENT_SECRET"
        )
        zoom_redirect_uri: str = Field(
            default="http://localhost:8000/api/oauth/zoom/callback",
            alias="ZOOM_REDIRECT_URI",
        )
        zoom_sdk_key: Optional[str] = Field(default=None, alias="ZOOM_SDK_KEY")
        zoom_sdk_secret: Optional[str] = Field(
            default=None, alias="ZOOM_SDK_SECRET"
        )

        # Database -----------------------------------------------------------
        database_url: str = Field(
            default="sqlite:///./auri.db", alias="DATABASE_URL"
        )

        # ----- computed -----------------------------------------------------

        @property
        def cors_allowed_origins(self) -> list[str]:
            return _split_csv(self.cors_allowed_origins_raw)

    _BACKEND = "pydantic-settings"

except ModuleNotFoundError:  # pragma: no cover — fallback path
    logger.warning(
        "[settings] pydantic-settings not installed — falling back to "
        "dataclass-based Settings (stdlib only)."
    )

    @dataclass(frozen=True)
    class Settings:  # type: ignore[no-redef]
        """Stdlib fallback when pydantic-settings is unavailable."""

        env: EnvMode = "dev"
        auth_mode: AuthMode = "dev"
        log_level: str = "INFO"
        fernet_key: Optional[str] = None
        cors_allowed_origins: list[str] = field(default_factory=list)
        rt_go_service_token: Optional[str] = None
        google_client_id: Optional[str] = None
        google_client_secret: Optional[str] = None
        google_redirect_uri: str = (
            "http://localhost:8000/api/oauth/google/callback"
        )
        microsoft_client_id: Optional[str] = None
        microsoft_client_secret: Optional[str] = None
        microsoft_tenant_id: str = "common"
        microsoft_redirect_uri: str = (
            "http://localhost:8000/api/oauth/microsoft/callback"
        )
        acs_connection_string: Optional[str] = None
        zoom_client_id: Optional[str] = None
        zoom_client_secret: Optional[str] = None
        zoom_redirect_uri: str = (
            "http://localhost:8000/api/oauth/zoom/callback"
        )
        zoom_sdk_key: Optional[str] = None
        zoom_sdk_secret: Optional[str] = None
        database_url: str = "sqlite:///./auri.db"

        @classmethod
        def _from_env(cls) -> "Settings":
            env_val = _env("ENV", "dev")
            auth_val = _env("AUTH_MODE", "dev")
            return cls(
                env="prod" if env_val == "prod" else "dev",
                auth_mode="prod" if auth_val == "prod" else "dev",
                log_level=_env("LOG_LEVEL", "INFO"),
                fernet_key=_env_optional("FERNET_KEY"),
                cors_allowed_origins=_split_csv(
                    _env("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
                ),
                rt_go_service_token=_env_optional("RT_GO_SERVICE_TOKEN"),
                google_client_id=_env_optional("GOOGLE_CLIENT_ID"),
                google_client_secret=_env_optional("GOOGLE_CLIENT_SECRET"),
                google_redirect_uri=_env(
                    "GOOGLE_REDIRECT_URI",
                    "http://localhost:8000/api/oauth/google/callback",
                ),
                microsoft_client_id=_env_optional("MICROSOFT_CLIENT_ID"),
                microsoft_client_secret=_env_optional("MICROSOFT_CLIENT_SECRET"),
                microsoft_tenant_id=_env("MICROSOFT_TENANT_ID", "common"),
                microsoft_redirect_uri=_env(
                    "MICROSOFT_REDIRECT_URI",
                    "http://localhost:8000/api/oauth/microsoft/callback",
                ),
                acs_connection_string=_env_optional("ACS_CONNECTION_STRING"),
                zoom_client_id=_env_optional("ZOOM_CLIENT_ID"),
                zoom_client_secret=_env_optional("ZOOM_CLIENT_SECRET"),
                zoom_redirect_uri=_env(
                    "ZOOM_REDIRECT_URI",
                    "http://localhost:8000/api/oauth/zoom/callback",
                ),
                zoom_sdk_key=_env_optional("ZOOM_SDK_KEY"),
                zoom_sdk_secret=_env_optional("ZOOM_SDK_SECRET"),
                database_url=_env("DATABASE_URL", "sqlite:///./auri.db"),
            )

    _BACKEND = "dataclass-fallback"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton accessor. Reads env at first call.

    Call ``get_settings.cache_clear()`` from tests after mutating env vars."""
    if _BACKEND == "pydantic-settings":
        return Settings()  # type: ignore[call-arg]
    return Settings._from_env()  # type: ignore[attr-defined]
