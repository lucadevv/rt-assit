"""Unit tests for ``GoogleOAuthClient`` (Sprint 1 — Meet provider).

Network calls are stubbed via monkeypatching ``httpx.AsyncClient`` so the
suite runs offline. We deliberately avoid ``respx`` here to keep the test
deps minimal — but the structure is straightforward to port to respx if
the team adopts it later."""
from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest

from app.infrastructure.oauth.google_oauth_client import (
    GOOGLE_OAUTH_SCOPES,
    GoogleOAuthClient,
    OAuthExchangeError,
)


# ---------------------------------------------------------------------------
# Test helpers — fake httpx response + AsyncClient
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(
        self,
        status_code: int,
        json_body: dict[str, Any] | None = None,
        text: str = "",
    ) -> None:
        self.status_code = status_code
        self._json = json_body
        self.text = text if text or json_body is None else str(json_body)

    def json(self) -> dict[str, Any]:
        if self._json is None:
            raise ValueError("not json")
        return self._json


class _FakeAsyncClient:
    """Drop-in replacement for ``httpx.AsyncClient`` capturing the last call."""

    last_post_url: str | None = None
    last_post_data: dict[str, Any] | None = None
    last_post_params: dict[str, Any] | None = None
    last_get_url: str | None = None
    last_get_headers: dict[str, str] | None = None

    # The class-level response is what the *next* instance will return.
    next_response: _FakeResponse = _FakeResponse(200, {"ok": True})

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> "_FakeAsyncClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def post(
        self,
        url: str,
        data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        **_: Any,
    ) -> _FakeResponse:
        type(self).last_post_url = url
        type(self).last_post_data = data
        type(self).last_post_params = params
        return type(self).next_response

    async def get(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        **_: Any,
    ) -> _FakeResponse:
        type(self).last_get_url = url
        type(self).last_get_headers = headers
        return type(self).next_response


@pytest.fixture(autouse=True)
def _reset_fake_client_state() -> None:
    _FakeAsyncClient.last_post_url = None
    _FakeAsyncClient.last_post_data = None
    _FakeAsyncClient.last_post_params = None
    _FakeAsyncClient.last_get_url = None
    _FakeAsyncClient.last_get_headers = None
    _FakeAsyncClient.next_response = _FakeResponse(200, {"ok": True})


@pytest.fixture()
def client() -> GoogleOAuthClient:
    return GoogleOAuthClient(
        client_id="cid",
        client_secret="csecret",
        redirect_uri="http://localhost:8000/api/oauth/google/callback",
    )


def _patch_httpx(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.infrastructure.oauth.google_oauth_client as mod

    monkeypatch.setattr(mod.httpx, "AsyncClient", _FakeAsyncClient)


# ---------------------------------------------------------------------------
# get_authorization_url
# ---------------------------------------------------------------------------


def test_authorization_url_contains_required_params(
    client: GoogleOAuthClient,
) -> None:
    url = client.get_authorization_url(state="abc123")

    parsed = urlparse(url)
    assert parsed.scheme == "https"
    assert parsed.netloc == "accounts.google.com"
    assert parsed.path == "/o/oauth2/v2/auth"

    qs = parse_qs(parsed.query)
    assert qs["client_id"] == ["cid"]
    assert qs["redirect_uri"] == [
        "http://localhost:8000/api/oauth/google/callback"
    ]
    assert qs["state"] == ["abc123"]
    assert qs["response_type"] == ["code"]
    assert qs["access_type"] == ["offline"]
    assert qs["prompt"] == ["consent"]


def test_authorization_url_includes_all_scopes(
    client: GoogleOAuthClient,
) -> None:
    url = client.get_authorization_url(state="s")
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    scope_str = qs["scope"][0]
    scopes = set(scope_str.split(" "))
    assert scopes == set(GOOGLE_OAUTH_SCOPES)
    assert "https://www.googleapis.com/auth/meetings.space.created" in scopes


def test_authorization_url_rejects_empty_state(
    client: GoogleOAuthClient,
) -> None:
    with pytest.raises(ValueError):
        client.get_authorization_url(state="")


# ---------------------------------------------------------------------------
# exchange_code
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_exchange_code_posts_to_token_url_with_payload(
    client: GoogleOAuthClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        200,
        {
            "access_token": "at",
            "refresh_token": "rt",
            "expires_in": 3600,
            "scope": "openid",
            "token_type": "Bearer",
            "id_token": "idt",
        },
    )

    result = await client.exchange_code("THECODE")
    assert result["access_token"] == "at"
    assert result["refresh_token"] == "rt"

    assert _FakeAsyncClient.last_post_url == "https://oauth2.googleapis.com/token"
    data = _FakeAsyncClient.last_post_data
    assert data is not None
    assert data["client_id"] == "cid"
    assert data["client_secret"] == "csecret"
    assert data["code"] == "THECODE"
    assert data["grant_type"] == "authorization_code"
    assert (
        data["redirect_uri"]
        == "http://localhost:8000/api/oauth/google/callback"
    )


@pytest.mark.asyncio
async def test_exchange_code_raises_on_non_200(
    client: GoogleOAuthClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        400, json_body=None, text='{"error":"invalid_grant"}'
    )

    with pytest.raises(OAuthExchangeError) as excinfo:
        await client.exchange_code("BADCODE")
    assert excinfo.value.status_code == 400
    assert excinfo.value.body is not None
    assert "invalid_grant" in excinfo.value.body


# ---------------------------------------------------------------------------
# refresh_access_token
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_access_token_posts_refresh_grant(
    client: GoogleOAuthClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        200, {"access_token": "new", "expires_in": 3600}
    )

    result = await client.refresh_access_token("REFRESH")
    assert result["access_token"] == "new"

    data = _FakeAsyncClient.last_post_data
    assert data is not None
    assert data["grant_type"] == "refresh_token"
    assert data["refresh_token"] == "REFRESH"


# ---------------------------------------------------------------------------
# revoke
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_revoke_calls_endpoint_with_token_param(
    client: GoogleOAuthClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(200, {})

    await client.revoke("TOKENVAL")
    assert _FakeAsyncClient.last_post_url == "https://oauth2.googleapis.com/revoke"
    assert _FakeAsyncClient.last_post_params == {"token": "TOKENVAL"}


@pytest.mark.asyncio
async def test_revoke_treats_400_as_already_revoked(
    client: GoogleOAuthClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        400, json_body=None, text='{"error":"invalid_token"}'
    )

    # Should NOT raise — already revoked is idempotent success.
    await client.revoke("OLD")


@pytest.mark.asyncio
async def test_revoke_raises_on_5xx(
    client: GoogleOAuthClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        503, json_body=None, text="upstream down"
    )

    with pytest.raises(OAuthExchangeError):
        await client.revoke("TOK")


# ---------------------------------------------------------------------------
# fetch_userinfo
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_userinfo_sets_bearer_header(
    client: GoogleOAuthClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        200,
        {
            "sub": "u123",
            "email": "a@b.com",
            "name": "Ada",
            "picture": "http://x",
        },
    )

    info = await client.fetch_userinfo("AT")
    assert info["email"] == "a@b.com"
    assert (
        _FakeAsyncClient.last_get_url
        == "https://openidconnect.googleapis.com/v1/userinfo"
    )
    headers = _FakeAsyncClient.last_get_headers or {}
    assert headers.get("Authorization") == "Bearer AT"


# ---------------------------------------------------------------------------
# constructor validation
# ---------------------------------------------------------------------------


def test_constructor_rejects_empty_required_fields() -> None:
    with pytest.raises(ValueError):
        GoogleOAuthClient(client_id="", client_secret="x", redirect_uri="y")
    with pytest.raises(ValueError):
        GoogleOAuthClient(client_id="x", client_secret="", redirect_uri="y")
    with pytest.raises(ValueError):
        GoogleOAuthClient(client_id="x", client_secret="y", redirect_uri="")
