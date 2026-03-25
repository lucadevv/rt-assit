// Package pipeline orchestrates all components via Go channels.
package pipeline

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/rtassist/rt_go/internal/audio"
	"github.com/rtassist/rt_go/internal/audioReceiver"
	"github.com/rtassist/rt_go/internal/cdp"
	"github.com/rtassist/rt_go/internal/intent"
	"github.com/rtassist/rt_go/internal/llm"
	"github.com/rtassist/rt_go/internal/overlay"
	"github.com/rtassist/rt_go/internal/stt"
)

// Pipeline orchestrates the audio processing pipeline.
type Pipeline struct {
	cfg Config

	// Components
	cdp           *cdp.Connector
	capturer      *cdp.Capturer
	deepgram      *stt.DeepgramClient
	llmClient     *llm.LLMClient
	overlay       *overlay.Server
	classifier    *intent.Classifier
	audioReceiver *audioReceiver.AudioReceiver

	// Flux mode: send WebM chunks directly without parsing
	useFlux bool

	// Channels
	chunkCh      chan []byte
	utteranceCh  chan audio.Utterance
	transcriptCh chan stt.Transcript
	tokenCh      chan llm.Token

	// Context history for conversation
	contextHistory []llm.ContextEntry
	historyMu      sync.RWMutex
	maxHistoryAge  time.Duration

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// Config holds pipeline configuration.
type Config struct {
	ChromePort    int
	OverlayPort   int
	AudioRecvPort int
	DeepgramKey   string
	LLMKey        string
	LLMBaseURL    string
	LLMModel      string
	SystemPrompt  string
}

// New creates a new Pipeline instance.
func New(cfg Config) *Pipeline {
	ctx, cancel := context.WithCancel(context.Background())

	chunkCh := make(chan []byte, 100)
	utteranceCh := make(chan audio.Utterance, 10)
	transcriptCh := make(chan stt.Transcript, 10)
	tokenCh := make(chan llm.Token, 100)

	return &Pipeline{
		cfg:            cfg,
		chunkCh:        chunkCh,
		utteranceCh:    utteranceCh,
		transcriptCh:   transcriptCh,
		tokenCh:        tokenCh,
		classifier:     intent.NewClassifier(),
		contextHistory: make([]llm.ContextEntry, 0, 50),
		maxHistoryAge:  60 * time.Second,
		ctx:            ctx,
		cancel:         cancel,
	}
}

// Start initializes and starts all pipeline components.
func (p *Pipeline) Start() error {
	var err error

	// Initialize overlay server
	overlayAddr := fmt.Sprintf(":%d", p.cfg.OverlayPort)
	p.overlay = overlay.NewServer(overlayAddr)

	// Initialize LLM client
	llmCfg := llm.LLMConfig{
		APIKey:       p.cfg.LLMKey,
		BaseURL:      p.cfg.LLMBaseURL,
		Model:        p.cfg.LLMModel,
		SystemPrompt: p.cfg.SystemPrompt,
		MaxHistory:   20,
	}
	p.llmClient = llm.NewLLMClient(llmCfg)

	// Initialize Deepgram client
	log.Printf("[Pipeline] DeepgramKey length: %d", len(p.cfg.DeepgramKey))
	p.deepgram = stt.NewDeepgramClient(p.cfg.DeepgramKey, p.transcriptCh)

	// Initialize CDP connector
	p.cdp = cdp.NewConnector(p.cfg.ChromePort)
	cdpCtx, err := p.cdp.Connect(p.ctx)
	if err != nil {
		return fmt.Errorf("failed to connect to Chrome: %w", err)
	}

	// Initialize capturer with the target context
	p.capturer = cdp.NewCapturer(p.chunkCh)
	if err := p.capturer.Start(cdpCtx); err != nil {
		return fmt.Errorf("failed to start audio capture: %w", err)
	}

	// NOTE: CDP injection is DISABLED because Meet blocks RTCPeerConnection override.
	// Audio capture is done via Chrome Extension (tabCapture) instead.
	// The extension connects to ws://localhost:8766/audio
	// See internal/cdp/script.go - injection is now handled by extension

	// Start Deepgram connection
	deepgramCfg := stt.DefaultDeepgramConfig()
	// Use nova-2 model (verified working with the new API key)
	deepgramCfg.APIKey = p.cfg.DeepgramKey
	deepgramCfg.UseFlux = false
	deepgramCfg.Model = "nova-2"
	deepgramCfg.Encoding = "linear16"
	deepgramCfg.SampleRate = 48000
	deepgramCfg.Channels = 1
	p.useFlux = false // Pipeline needs to process audio (VAD, etc)
	if err := p.deepgram.Start(p.ctx, deepgramCfg); err != nil {
		return fmt.Errorf("failed to start Deepgram: %w", err)
	}

	// Start overlay server
	go func() {
		if err := p.overlay.Start(p.ctx); err != nil {
			log.Printf("Overlay server error: %v", err)
		}
	}()

	// Start audio receiver for Chrome extension
	audioRecvAddr := fmt.Sprintf(":%d", p.cfg.AudioRecvPort)
	p.audioReceiver = audioReceiver.NewAudioReceiver(audioRecvAddr, p.chunkCh)
	go func() {
		if err := p.audioReceiver.Start(p.ctx); err != nil {
			log.Printf("[Pipeline] AudioReceiver error: %v", err)
		}
	}()

	// Start pipeline stages
	p.startVADStage() // Now sends directly to Deepgram
	// startSTTStage() // Disabled - VAD stage handles Deepgram directly now
	p.startLLMStage()
	p.startOverlayStage()

	log.Println("Pipeline started successfully")
	log.Printf("  Chrome CDP: localhost:%d", p.cfg.ChromePort)
	log.Printf("  Overlay WebSocket: ws://localhost:%d", p.cfg.OverlayPort)

	return nil
}

// startVADStage processes audio chunks and sends to Deepgram.
// When useFlux=true, chunks are sent directly without parsing (Flux handles WebM natively).
// Otherwise, raw PCM (linear16 from AudioWorklet) is sent directly.
func (p *Pipeline) startVADStage() {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		chunkCount := 0

		for {
			select {
			case <-p.ctx.Done():
				return
			case data, ok := <-p.chunkCh:
				if !ok {
					return
				}

				chunkCount++

				// Skip very small chunks (likely headers or silence)
				if len(data) < 100 {
					if chunkCount <= 10 {
						log.Printf("[VAD] Chunk %d: %d bytes (too small, skipping)", chunkCount, len(data))
					}
					continue
				}

				if p.useFlux {
					// Flux mode: send WebM chunks directly without any parsing
					if chunkCount <= 5 {
						log.Printf("[VAD] Chunk %d: %d bytes (Flux: sending directly)", chunkCount, len(data))
					}
					if err := p.deepgram.Send(data); err != nil {
						log.Printf("[VAD] Deepgram send error: %v", err)
					}
				} else {
					// Legacy mode: PCM from AudioWorklet (linear16, 48kHz, mono)
					// Check if data looks like WebM (starts with EBML magic bytes)
					if len(data) > 4 && data[0] == 0x1A && data[1] == 0x45 && data[2] == 0xDF && data[3] == 0xA3 {
						// Looks like WebM header - this shouldn't happen with AudioWorklet
						// but handle it just in case
						if chunkCount <= 5 {
							log.Printf("[VAD] Chunk %d: %d bytes (unexpected WebM, skipping)", chunkCount, len(data))
						}
						continue
					} else {
						// Raw PCM (Int16 linear16 from AudioWorklet) - send directly
						if chunkCount <= 5 {
							log.Printf("[VAD] Chunk %d: %d bytes (PCM direct)", chunkCount, len(data))
						}
						if err := p.deepgram.Send(data); err != nil {
							log.Printf("[VAD] Deepgram send error: %v", err)
						}
					}
				}
			}
		}
	}()
}

// startSTTStage sends utterances to Deepgram for transcription.
func (p *Pipeline) startSTTStage() {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		utteranceCount := 0
		for {
			select {
			case <-p.ctx.Done():
				return
			case utterance, ok := <-p.utteranceCh:
				if !ok {
					return
				}

				utteranceCount++
				log.Printf("[STT] Utterance #%d: %d bytes, duration %v",
					utteranceCount, len(utterance.Audio), utterance.Duration)

				// Send to Deepgram
				if err := p.deepgram.Send(utterance.Audio); err != nil {
					log.Printf("[STT] Deepgram send error: %v", err)
					continue
				}

				// Signal end of utterance
				if err := p.deepgram.SendFinalize(); err != nil {
					log.Printf("[STT] Deepgram finalize error: %v", err)
				}

				log.Printf("[STT] Sent to Deepgram, waiting for response...")
			}
		}
	}()
}

// startLLMStage processes transcriptions and generates responses.
func (p *Pipeline) startLLMStage() {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		for {
			select {
			case <-p.ctx.Done():
				return
			case transcript, ok := <-p.transcriptCh:
				if !ok {
					return
				}

				if transcript.Text == "" {
					continue
				}

				log.Printf("[STT] Transcript: %q (confidence: %.2f)", transcript.Text, transcript.Confidence)

				// Add to context history
				p.addToHistory(transcript.Text, "interviewer", false)

				// Broadcast transcript to overlay
				p.overlay.Hub().BroadcastTranscript(transcript.Text)

				// Classify intent
				intentType := p.classifier.Classify(transcript.Text)
				log.Printf("[Intent] Classified as: %s", intentType)

				if !p.classifier.ShouldRespond(intentType) {
					log.Printf("[Intent] Skipping (small talk)")
					continue
				}

				// Notify UI that we're thinking
				p.overlay.Hub().Broadcast(overlay.Message{
					Type:    "thinking",
					Content: "Analizando...",
				})

				// Send to LLM and stream tokens
				go func() {
					if err := p.llmClient.Send(p.ctx, transcript.Text, p.tokenCh); err != nil {
						log.Printf("[LLM] Error: %v", err)
						p.overlay.Hub().BroadcastError(err.Error())
					}
				}()
			}
		}
	}()
}

// startOverlayStage broadcasts tokens to connected UI clients.
func (p *Pipeline) startOverlayStage() {
	var fullResponse strings.Builder

	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		for {
			select {
			case <-p.ctx.Done():
				return
			case token, ok := <-p.tokenCh:
				if !ok {
					return
				}

				if token.Done {
					// Response complete
					p.overlay.Hub().BroadcastToken("\n")
					log.Printf("[LLM] Response complete: %d chars", fullResponse.Len())

					// Add to history
					if fullResponse.Len() > 0 {
						p.addToHistory(fullResponse.String(), "assistant", true)
					}
					fullResponse.Reset()
				} else {
					fullResponse.WriteString(token.Content)
					p.overlay.Hub().BroadcastToken(token.Content)
				}
			}
		}
	}()
}

// addToHistory adds an entry to the conversation context.
func (p *Pipeline) addToHistory(text, speaker string, isAssistant bool) {
	p.historyMu.Lock()
	defer p.historyMu.Unlock()

	p.contextHistory = append(p.contextHistory, llm.ContextEntry{
		Text:        text,
		Speaker:     speaker,
		Timestamp:   time.Now(),
		IsAssistant: isAssistant,
	})

	// Trim old entries
	p.trimHistory()
}

// trimHistory removes entries older than maxHistoryAge.
func (p *Pipeline) trimHistory() {
	cutoff := time.Now().Add(-p.maxHistoryAge)
	newHistory := make([]llm.ContextEntry, 0, len(p.contextHistory))

	for _, entry := range p.contextHistory {
		if entry.Timestamp.After(cutoff) {
			newHistory = append(newHistory, entry)
		}
	}

	p.contextHistory = newHistory
}

// Stop gracefully shuts down all pipeline components.
func (p *Pipeline) Stop() {
	log.Println("Stopping pipeline...")

	p.cancel()

	// Stop Deepgram
	if p.deepgram != nil {
		p.deepgram.Stop()
	}

	// Stop LLM
	if p.llmClient != nil {
		p.llmClient.Stop()
	}

	// Stop CDP
	if p.cdp != nil {
		p.cdp.Disconnect()
	}

	// Stop overlay
	if p.overlay != nil {
		p.overlay.Stop()
	}

	p.wg.Wait()

	close(p.chunkCh)
	close(p.utteranceCh)
	close(p.transcriptCh)
	close(p.tokenCh)

	log.Println("Pipeline stopped")
}

// ChunkChan returns the channel for incoming audio chunks.
func (p *Pipeline) ChunkChan() chan<- []byte {
	return p.chunkCh
}

// OverlayHub returns the overlay hub for broadcasting.
func (p *Pipeline) OverlayHub() *overlay.Hub {
	if p.overlay == nil {
		return nil
	}
	return p.overlay.Hub()
}

// GetHistory returns the current conversation history.
func (p *Pipeline) GetHistory() []llm.ContextEntry {
	p.historyMu.RLock()
	defer p.historyMu.RUnlock()

	result := make([]llm.ContextEntry, len(p.contextHistory))
	copy(result, p.contextHistory)
	return result
}
