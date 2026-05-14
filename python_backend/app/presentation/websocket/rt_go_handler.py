"""rt_go WebSocket handler.

Receives transcripts from the Go gateway, broadcasts them to web/mac clients,
and dispatches the agent path through ProcessTranscriptUseCase.

B1 wire-format additions (optional, backward compatible):
- ``session_id``: UUID of the live session (returned by POST /api/sessions).
  When present (and the session row exists for ``user_id``), transcripts and
  hints are persisted to the DB. When absent, the message still flows for
  broadcast + agent generation but is NOT persisted (warn log).
- ``user_id``: forwarded by the audio client for multi-tenant routing.

Module-level dedup state matches the previous behaviour 1:1."""
import json
import logging
import time
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.application.services.transcript_session_state import (
    SessionStateRegistry,
)
from app.application.use_cases.process_transcript import ProcessTranscriptUseCase
from app.presentation.websocket.connection_manager import ConnectionManager


logger = logging.getLogger(__name__)


# Process-local dedup state for final transcripts. Matches the legacy
# last_transcript dict from api/websocket.py — kept identical so behaviour
# does not change post-refactor.
_last_transcript: dict[str, object] = {"text": "", "timestamp": 0}


# Legacy fallback session id when a message arrives without one. Keeps
# the conversation_repo (in-memory chat history) keyed deterministically
# so generate_response stays consistent for legacy callers.
LEGACY_SESSION_ID = "default"


async def rt_go_endpoint(
    websocket: WebSocket,
    manager: ConnectionManager,
    process_uc: ProcessTranscriptUseCase,
    session_state_registry: SessionStateRegistry,
) -> None:
    await manager.connect_rt_go(websocket)

    # Fase C — track the most recent session_id we've seen on this rt_go
    # connection so we can pop its state on disconnect. rt_go is single-
    # connection per browser (one mic per user) so a single tracker is enough.
    # On a session change mid-connection we pop the OLD one to avoid leaks.
    last_session_id: Optional[str] = None

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            logger.info(f"Received from rt_go: {message.get('type')}")

            if message.get("type") == "transcript":
                transcript = message.get("content", "").strip()
                if not transcript:
                    transcript = message.get("text", "").strip()

                is_final = message.get("is_final", True)
                is_speculative = message.get("is_speculative", False)

                # B1: extract session_id + user_id from message envelope.
                session_id: str = message.get("session_id") or LEGACY_SESSION_ID
                user_id: Optional[str] = message.get("user_id")
                deepgram_speaker = message.get("speaker")
                language = message.get("language")
                confidence = message.get("confidence")

                # Track for disconnect cleanup. We only track real sessions
                # (skip LEGACY) so the legacy "default" key isn't popped from
                # under other legacy callers when this connection drops.
                if session_id and session_id != LEGACY_SESSION_ID:
                    last_session_id = session_id

                logger.info(
                    f"[RT-GO] Transcript: {transcript[:50]}... "
                    f"(final={is_final}, speculative={is_speculative}, "
                    f"session={session_id}, user={user_id})"
                )

                # Cambio 1 — emit a single {"type":"listening"} broadcast
                # on the FIRST interim transcript of each turn so the
                # frontend's AgentPhase indicator can flip to "Escuchando…"
                # without us spamming the WS on every Deepgram partial.
                # The debounce flag lives on the per-session state and is
                # reset when a final transcript is processed.
                if (
                    transcript
                    and not is_final
                    and not is_speculative
                    and session_id != LEGACY_SESSION_ID
                ):
                    state = session_state_registry.get(session_id)
                    if not state.listening_emitted_for_current_turn:
                        state.listening_emitted_for_current_turn = True
                        await manager.broadcast({"type": "listening"})

                # Speculative transcripts: process immediately, no dedup.
                if is_speculative:
                    logger.info(
                        f"[RT-GO] Processing speculative transcript: {transcript[:30]}..."
                    )
                    await manager.broadcast(
                        {"type": "transcript", "content": transcript}
                    )
                    if transcript:
                        await process_uc.execute(
                            transcript=transcript,
                            is_speculative=True,
                            session_id=session_id,
                            user_id=user_id,
                            deepgram_speaker=deepgram_speaker,
                            language=language,
                            confidence=confidence,
                        )

                # Final transcripts: deduped against the last processed text.
                elif is_final and transcript != _last_transcript["text"]:
                    _last_transcript["text"] = transcript
                    _last_transcript["timestamp"] = time.time()

                    # Reset the listening debounce flag so the NEXT turn
                    # gets its own "listening" edge when interim partials
                    # start arriving again.
                    if session_id != LEGACY_SESSION_ID:
                        state = session_state_registry.get(session_id)
                        state.listening_emitted_for_current_turn = False

                    await manager.broadcast(
                        {"type": "transcript", "content": transcript}
                    )

                    if transcript:
                        await process_uc.execute(
                            transcript=transcript,
                            is_speculative=False,
                            session_id=session_id,
                            user_id=user_id,
                            deepgram_speaker=deepgram_speaker,
                            language=language,
                            confidence=confidence,
                        )
                elif is_final:
                    logger.info(
                        f"[RT-GO] Skipping duplicate transcript: {transcript[:30]}..."
                    )
                    # Even on dedup-skip we want a fresh "listening" edge
                    # for the NEXT user turn — otherwise after a duplicate
                    # final the listening flag would stay True forever.
                    if session_id != LEGACY_SESSION_ID:
                        state = session_state_registry.get(session_id)
                        state.listening_emitted_for_current_turn = False

            # Cancel an in-flight speculative response when rt_go signals
            # the user resumed talking.
            elif message.get("type") == "turn_resumed":
                logger.info("[RT-GO] Turn resumed - cancelling speculative response")
                await manager.broadcast({"type": "cancelled", "text": ""})

            # Fase C — Deepgram's explicit "the speaker finished talking"
            # signal. Used by the LangGraph coalesce_node as an early-exit
            # from its wall-clock window: instead of waiting 800–1800ms for
            # a hypothetical follow-up final, we break out the moment
            # Deepgram tells us the utterance ended for real.
            elif message.get("type") == "utterance_end":
                ue_session_id: str = (
                    message.get("session_id") or LEGACY_SESSION_ID
                )
                if ue_session_id and ue_session_id != LEGACY_SESSION_ID:
                    last_session_id = ue_session_id
                # Only fire on real sessions — a stale signal on LEGACY
                # would just touch the default-session state and add noise.
                if ue_session_id != LEGACY_SESSION_ID:
                    state = session_state_registry.get(ue_session_id)
                    state.signal_utterance_end()
                    logger.info(
                        "[RT-GO] UtteranceEnd → signalled session=%s",
                        ue_session_id,
                    )
                else:
                    logger.debug(
                        "[RT-GO] UtteranceEnd received without session_id; "
                        "ignoring (legacy client)"
                    )

    except WebSocketDisconnect:
        logger.info("rt_go disconnected")
    finally:
        manager.disconnect_rt_go()
        # Fase C — defensive cleanup so a long-running rt_go session that
        # closes without a /api/sessions/{id}/end call (crash, network drop)
        # doesn't leak its SessionConversationState until process restart.
        # The primary cleanup point is still the REST end-session endpoint;
        # this is just the safety net for abnormal disconnects.
        if last_session_id:
            session_state_registry.pop(last_session_id)
            logger.info(
                "[RT-GO] Disconnect cleanup: popped state for session=%s",
                last_session_id,
            )
