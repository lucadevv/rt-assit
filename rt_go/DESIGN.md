# Design: build-rtassist

## Technical Approach

The system implements a real-time audio processing pipeline that captures audio from Chrome video calls via Chrome DevTools Protocol (CDP), performs voice activity detection, sends audio to Deepgram for speech-to-text transcription, processes transcripts with GLM-4-Flash LLM for intelligent responses, and streams resulting tokens to a UI overlay via WebSocket. This directly maps to the proposal's phased approach: starting with project scaffolding, then implementing each pipeline stage sequentially.

## Architecture Decisions

### Decision: CDP Library Selection

**Choice**: chromedp + cdproto/runtime
**Alternatives considered**: pure CDP via websocket, selenium
**Rationale**: chromedp provides high-level Chrome automation while cdproto/runtime gives direct access to Runtime.addBinding for custom JS bindings, enabling efficient audio capture without excessive complexity or external dependencies.

### Decision: Voice Activity Detection Implementation

**Choice**: go-vad (github.com/rojopolis/govad.v2)
**Alternatives considered**: webrtcvad (cgo), silero (torch dependency)
**Rationale**: Pure Go implementation with no external dependencies, energy-based VAD suitable for real-time processing, configurable thresholds for tuning false positive/negative rates.

### Decision: Speech-to-Text Client

**Choice**: deepgram-go-sdk
**Alternatives considered**: raw websocket client, assemblyai SDK
**Rationale**: Official SDK provides WebSocket streaming with automatic reconnection, proper audio format handling, and optimized for Deepgram's low-latency streaming API.

### Decision: LLM Client Implementation

**Choice**: openai-go v3 with custom base URL
**Alternatives considered**: raw HTTP client, zhipuai SDK
**Rationale**: OpenAI compatibility layer works with GLM-4-Flash endpoint, provides built-in streaming response handling, and is actively maintained with good documentation.

### Decision: WebSocket Implementation

**Choice**: gorilla/websocket with Hub pattern
**Alternatives considered**: nhooyr.io/websocket, custom implementation
**Rationale**: Battle-tested library, supports multiple concurrent clients, clean separation between connection handling and message broadcasting, well-established patterns.

### Decision: Pipeline Orchestration

**Choice**: Go channels (no mutexes)
**Alternatives considered**: actor libraries, mutex-protected queues
**Rationale**: Communicating Sequential Processes (CSP) model fits audio pipeline naturally, avoids shared state complexity, provides built-in synchronization, and follows Go idioms.

## Data Flow

```
CDP Capturer ──→ VAD ──→ STT ──→ LLM ──→ Overlay Hub ──→ WebSocket ──→ UI
     AudioChunk   Utterance  Transcript  Token    OverlayMessage
```

Data flows unidirectionally through typed channels:
1. CDP Capturer emits AudioChunk objects containing base64-encoded audio data
2. VAD processes chunks and emits Utterance objects when speech boundaries detected
3. STT consumes utterances and emits Transcript objects with text results
4. LLM processes transcripts and emits Token objects for streaming responses
5. Overlay Hub broadcasts Token objects as OverlayMessage JSON to connected UI clients

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `cmd/rtassist/main.go` | Create | Entry point with CLI flag parsing, context setup, pipeline initialization |
| `internal/cdp/connector.go` | Create | Chrome connection management, tab detection for video calls |
| `internal/cdp/capturer.go` | Create | Audio chunk receiver via Runtime.addBinding from injected JS |
| `internal/cdp/script.go` | Create | JS injection string that captures audio and sends via binding |
| `internal/audio/vad.go` | Create | Voice activity detection using govad library |
| `internal/audio/buffer.go` | Create | Utterance accumulation logic with 600ms silence threshold |
| `internal/stt/deepgram.go` | Create | Deepgram WebSocket client for streaming STT |
| `internal/llm/client.go` | Create | OpenAI-compatible LLM client for GLM-4-Flash |
| `internal/overlay/server.go` | Create | WebSocket server setup and routing |
| `internal/overlay/hub.go` | Create | Client connection hub using gorilla/websocket pattern |
| `internal/pipeline/pipeline.go` | Create | Channel orchestration connecting all components |

## Interfaces / Contracts

```go
type AudioChunk struct {
    Data     []byte
    Timestamp time.Time
}

type Utterance struct {
    Audio    []byte
    Duration time.Duration
}

type Transcript struct {
    Text      string
    StartTime time.Time
    EndTime   time.Time
}

type Token struct {
    Content  string
    Index    int
}

type OverlayMessage struct {
    Type    string // "token", "transcript", "error"
    Content string
    Ms      int64  // Unix milliseconds timestamp
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | VAD speech/silence detection logic | Mock audio buffers, test energy threshold crossing |
| Unit | Utterance accumulation and boundary detection | Test buffer filling, silence detection, utterance emission |
| Unit | Channel routing and message formatting | Verify correct data flow between pipeline stages |
| Integration | End-to-end pipeline with mocked external services | Use mock Deepgram/LLM servers, verify data transformation |
| Integration | WebSocket hub broadcast to multiple clients | Test connection handling, message delivery, disconnection |
| E2E | Planned for v2 with actual Chrome and test credentials | Not included in v1 due to external dependency complexity |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] Should we implement automatic reconnection logic for external services (Deepgram, LLM)?
- [ ] What logging framework should we standardize on (zap, zerolog, etc.)?
- [ ] Should we add configurable timeouts for each pipeline stage?