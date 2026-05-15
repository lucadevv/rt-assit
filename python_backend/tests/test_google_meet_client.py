"""Unit tests for ``GoogleMeetClient`` (Sprint 1 — Meet provider).

httpx calls are stubbed via monkeypatching ``httpx.AsyncClient`` so the
suite runs offline. Mirrors the ``test_google_oauth_client.py`` pattern."""
from __future__ import annotations

from typing import Any

import pytest

from app.infrastructure.meet.google_meet_client import (
    GoogleMeetClient,
    MeetApiError,
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
    """Stand-in for ``httpx.AsyncClient`` capturing the last call."""

    last_post_url: str | None = None
    last_post_headers: dict[str, str] | None = None
    last_post_json: dict[str, Any] | None = None
    next_response: _FakeResponse = _FakeResponse(200, {})
    aclose_called: bool = False

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def post(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        json: dict[str, Any] | None = None,
        **_: Any,
    ) -> _FakeResponse:
        type(self).last_post_url = url
        type(self).last_post_headers = headers
        type(self).last_post_json = json
        return type(self).next_response

    async def aclose(self) -> None:
        type(self).aclose_called = True


@pytest.fixture(autouse=True)
def _reset_fake_state() -> None:
    _FakeAsyncClient.last_post_url = None
    _FakeAsyncClient.last_post_headers = None
    _FakeAsyncClient.last_post_json = None
    _FakeAsyncClient.aclose_called = False
    _FakeAsyncClient.next_response = _FakeResponse(200, {})


def _patch_httpx(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.infrastructure.meet.google_meet_client as mod

    monkeypatch.setattr(mod.httpx, "AsyncClient", _FakeAsyncClient)


# ---------------------------------------------------------------------------
# create_space — happy path + errors
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_space_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        200,
        {
            "name": "spaces/abc123",
            "meetingUri": "https://meet.google.com/abc-defg-hij",
            "meetingCode": "abc-defg-hij",
            "config": {"accessType": "OPEN"},
        },
    )

    client = GoogleMeetClient()
    space = await client.create_space(access_token="AT")

    assert space["name"] == "spaces/abc123"
    assert space["meeting_uri"] == "https://meet.google.com/abc-defg-hij"
    assert space["meeting_code"] == "abc-defg-hij"

    assert _FakeAsyncClient.last_post_url == "https://meet.googleapis.com/v2/spaces"
    headers = _FakeAsyncClient.last_post_headers or {}
    assert headers.get("Authorization") == "Bearer AT"
    assert headers.get("Content-Type") == "application/json"
    assert _FakeAsyncClient.last_post_json == {}
    # The default (un-injected) client should be closed after use.
    assert _FakeAsyncClient.aclose_called is True


@pytest.mark.asyncio
async def test_create_space_raises_on_400(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        400, json_body=None, text='{"error":"invalid_argument"}'
    )

    client = GoogleMeetClient()
    with pytest.raises(MeetApiError) as excinfo:
        await client.create_space(access_token="AT")
    assert excinfo.value.status == 400
    assert "invalid_argument" in excinfo.value.body


@pytest.mark.asyncio
async def test_create_space_raises_on_401(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        401, json_body=None, text='{"error":"unauthenticated"}'
    )

    client = GoogleMeetClient()
    with pytest.raises(MeetApiError) as excinfo:
        await client.create_space(access_token="bad")
    assert excinfo.value.status == 401


@pytest.mark.asyncio
async def test_create_space_raises_on_500(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_httpx(monkeypatch)
    _FakeAsyncClient.next_response = _FakeResponse(
        500, json_body=None, text="upstream down"
    )

    client = GoogleMeetClient()
    with pytest.raises(MeetApiError) as excinfo:
        await client.create_space(access_token="AT")
    assert excinfo.value.status == 500
    assert "upstream down" in excinfo.value.body
