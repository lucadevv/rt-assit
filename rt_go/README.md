# rtassist

Real-time interview assistant. Captures audio from Chrome video calls, transcribes with Deepgram, and provides AI-assisted responses via GLM-4.

## Quick Start

### 1. Setup

```bash
# Clone and enter
cd rt_go

# Install dependencies
make deps

# Create .env from template
make env-setup

# Edit .env with your API keys
# IMPORTANT: Replace the placeholder values with your real keys
vim .env
```

### 2. Configure API Keys

Edit `.env` and set these **required** values:

```bash
# Get from https://console.deepgram.com
DEEPGRAM_API_KEY=your_actual_deepgram_key

# Get from https://open.bigmodel.cn (GLM-4) or https://platform.openai.com (OpenAI)
LLM_API_KEY=your_actual_llm_key
```

### 3. Run

**Terminal 1: Start Chrome with remote debugging**
```bash
make chrome
```

**Terminal 2: Run rtassist**
```bash
make run
```

### 4. Use

1. Open a video call (Google Meet, Teams, or Zoom) in the Chrome window
2. Connect your UI to `ws://localhost:8765`
3. The assistant will help with technical/behavioral questions

## Architecture

```
Chrome (Meet/Teams/Zoom)
    │
    │  WebRTC audio
    ▼
CDP Capturer ──► VAD ──► Deepgram STT ──► Intent Classifier ──► GLM-4 ──► Overlay WS
    │                        │                      │                │              │
    └── JS injection    └── 600ms silence     └── technical/    └── streaming   └── UI clients
        via CDP              = utterance         behavioral         tokens
```

## Project Structure

```
rt_go/
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
├── Makefile              # Build commands
├── README.md             # This file
├── cmd/
│   └── rtassist/
│       └── main.go       # Entry point
├── internal/
│   ├── config/           # Configuration management
│   ├── cdp/              # Chrome DevTools Protocol
│   │   ├── connector.go  # Chrome connection
│   │   ├── capturer.go   # Audio capture via JS
│   │   ├── script.go     # Injected JavaScript
│   │   └── navigator.go  # Find meeting tabs
│   ├── audio/            # Audio processing
│   │   ├── vad.go        # Voice Activity Detection
│   │   └── buffer.go     # Utterance buffering
│   ├── stt/              # Speech-to-Text
│   │   └── deepgram.go   # Deepgram streaming client
│   ├── intent/           # Intent classification
│   │   └── classifier.go # Technical/behavioral/small-talk
│   ├── llm/              # Large Language Model
│   │   ├── client.go     # OpenAI-compatible client
│   │   └── prompts.go    # System prompts
│   ├── overlay/          # WebSocket server
│   │   ├── server.go     # HTTP + WS server
│   │   └── hub.go        # Client broadcasting
│   └── pipeline/         # Orchestration
│       └── pipeline.go   # Channel-based pipeline
├── pkg/utils/            # Shared utilities
│   └── audio.go          # Audio helpers
├── go.mod
└── go.sum
```

## Make Commands

```bash
make help          # Show all commands
make build         # Build binary
make run           # Build and run (requires .env)
make test          # Run tests
make deps          # Install dependencies
make chrome        # Start Chrome with debugging
make env-setup     # Create .env from template
make clean         # Remove build artifacts
```

## Environment Variables

See `.env.example` for all available options.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEEPGRAM_API_KEY` | ✅ | - | Deepgram API key |
| `LLM_API_KEY` | ✅ | - | GLM-4 / OpenAI API key |
| `LLM_BASE_URL` | | `https://open.bigmodel.cn/api/paas/v4` | LLM API endpoint |
| `LLM_MODEL` | | `glm-4-flash` | Model name |
| `CHROME_PORT` | | `9222` | Chrome debugging port |
| `OVERLAY_PORT` | | `8765` | WebSocket port |

## WebSocket Protocol

Connect to `ws://localhost:8765` to receive messages:

```json
{"type": "token", "content": "word ", "ms": 123}
{"type": "transcript", "content": "What is a closure?", "ms": 456}
{"type": "thinking", "content": "Analizando...", "ms": 789}
{"type": "error", "content": "LLM error", "ms": 1000}
```

## Latency Targets

| Stage | Target |
|-------|--------|
| Audio → STT | < 200ms |
| STT → Intent | < 1ms |
| Intent → LLM first token | < 100ms |
| Total | < 500ms |

## Troubleshooting

### Chrome connection failed
```
❌ Failed to connect to Chrome: ...
```
**Solution**: Run Chrome with debugging first:
```bash
make chrome
```

### API key errors
```
❌ DEEPGRAM_API_KEY is required
```
**Solution**: Edit `.env` and add your API keys.

### No meeting tab found
```
No meeting tab found
```
**Solution**: Open a Meet/Teams/Zoom call in the Chrome window.

### Port already in use
```
bind() failed: Address already in use
```
**Solution**: Kill existing Chrome process or use a different port:
```bash
pkill -f "chrome-rt-debug"
```

## Development

```bash
# Run tests
make test

# Format code
make fmt

# Run in dev mode (no build)
make dev
```

## License

MIT
