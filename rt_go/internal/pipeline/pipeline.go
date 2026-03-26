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
	"github.com/rtassist/rt_go/internal/ports"
	"github.com/rtassist/rt_go/internal/stt"
)

// Stage represents a pipeline stage as a function
type Stage func(ctx context.Context, input <-chan interface{}) <-chan interface{}

// PipelineBuilder constructs a pipeline using fluent API
type PipelineBuilder struct {
	config Config
}

func NewPipelineBuilder() *PipelineBuilder {
	return &PipelineBuilder{}
}

func (b *PipelineBuilder) WithConfig(cfg Config) *PipelineBuilder {
	b.config = cfg
	return b
}

func (b *PipelineBuilder) Build() (*Pipeline, error) {
	return New(b.config), nil
}

// Pipeline represents the audio processing pipeline
type Pipeline struct {
	cfg Config

	// Components
	cdp           *cdp.Connector
	capturer      *cdp.Capturer
	deepgram      *stt.DeepgramClient
	llmClient     ports.LLMPort
	overlay       *overlay.Server
	classifier    *intent.Classifier
	audioReceiver *audioReceiver.AudioReceiver
	aggregator    *stt.TranscriptAggregator

	// Channels
	chunkCh        chan []byte
	utteranceCh    chan audio.Utterance
	transcriptCh   chan stt.Transcript
	tokenCh        chan llm.Token
	utteranceEndCh chan struct{}

	// Full transcript output
	fullTranscriptCh chan string

	// Context history
	contextHistory []llm.ContextEntry
	historyMu      sync.RWMutex
	maxHistoryAge  time.Duration

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// Config holds pipeline configuration
type Config struct {
	ChromePort    int
	OverlayPort   int
	AudioRecvPort int
	DeepgramKey   string
	LLMKey        string
	LLMBaseURL    string
	LLMModel      string
	LLMProvider   string
	SystemPrompt  string
}

// New creates a new Pipeline
func New(cfg Config) *Pipeline {
	ctx, cancel := context.WithCancel(context.Background())

	chunkCh := make(chan []byte, 100)
	utteranceCh := make(chan audio.Utterance, 10)
	transcriptCh := make(chan stt.Transcript, 10)
	tokenCh := make(chan llm.Token, 100)
	utteranceEndCh := make(chan struct{}, 10)
	fullTranscriptCh := make(chan string, 10)

	return &Pipeline{
		cfg:              cfg,
		chunkCh:          chunkCh,
		utteranceCh:      utteranceCh,
		transcriptCh:     transcriptCh,
		tokenCh:          tokenCh,
		utteranceEndCh:   utteranceEndCh,
		fullTranscriptCh: fullTranscriptCh,
		classifier:       intent.NewClassifier(),
		aggregator:       stt.NewTranscriptAggregator(),
		contextHistory:   make([]llm.ContextEntry, 0, 50),
		maxHistoryAge:    60 * time.Second,
		ctx:              ctx,
		cancel:           cancel,
	}
}

// Start initializes and starts all pipeline components
func (p *Pipeline) Start() error {
	// Initialize overlay server
	overlayAddr := fmt.Sprintf(":%d", p.cfg.OverlayPort)
	p.overlay = overlay.NewServer(overlayAddr)

	// Initialize LLM client using factory
	llmCfg := ports.LLMConfig{
		APIKey:     p.cfg.LLMKey,
		BaseURL:    p.cfg.LLMBaseURL,
		Model:      p.cfg.LLMModel,
		Prompt:     p.cfg.SystemPrompt,
		MaxHistory: 20,
		Provider:   p.cfg.LLMProvider,
	}
	var err error
	p.llmClient, err = llm.NewLLMClientFromConfig(llmCfg)
	if err != nil {
		return fmt.Errorf("failed to create LLM client: %w", err)
	}

	// Initialize Deepgram client
	p.deepgram = stt.NewDeepgramClientWithUtteranceEnd(p.cfg.DeepgramKey, p.transcriptCh, p.utteranceEndCh)

	// Start Deepgram connection
	deepgramCfg := stt.DefaultDeepgramConfig()
	deepgramCfg.APIKey = p.cfg.DeepgramKey
	deepgramCfg.Model = "nova-2"
	deepgramCfg.Encoding = "linear16"
	deepgramCfg.SampleRate = 48000
	deepgramCfg.Channels = 1
	deepgramCfg.Language = "es-419"

	// Habilitar solo utterance_end_ms (el más importante)
	deepgramCfg.UtteranceEndMs = 1000 // 1 segundo de silencio = fin de utterance
	// NO endpointing ni vad_events - causan errores

	log.Printf("[Deepgram] Utterance detection: utterance_end_ms=%d", deepgramCfg.UtteranceEndMs)

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
	p.startVADStage()
	p.startLLMStage()
	p.startOverlayStage()

	log.Println("Pipeline started successfully")
	log.Printf("  Chrome CDP: localhost:%d", p.cfg.ChromePort)
	log.Printf("  Overlay WebSocket: ws://localhost:%d", p.cfg.OverlayPort)

	return nil
}

// Stop gracefully shuts down all pipeline components
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
	close(p.utteranceEndCh)
	close(p.fullTranscriptCh)

	log.Println("Pipeline stopped")
}

// ChunkChan returns the channel for incoming audio chunks
func (p *Pipeline) ChunkChan() chan<- []byte {
	return p.chunkCh
}

// OverlayHub returns the overlay hub for broadcasting
func (p *Pipeline) OverlayHub() *overlay.Hub {
	if p.overlay == nil {
		return nil
	}
	return p.overlay.Hub()
}

// GetHistory returns the current conversation history
func (p *Pipeline) GetHistory() []llm.ContextEntry {
	p.historyMu.RLock()
	defer p.historyMu.RUnlock()

	result := make([]llm.ContextEntry, len(p.contextHistory))
	copy(result, p.contextHistory)
	return result
}

// startVADStage processes audio chunks and sends to Deepgram
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

				// Skip very small chunks
				if len(data) < 100 {
					continue
				}

				// Send directly to Deepgram (PCM from AudioWorklet)
				if err := p.deepgram.Send(data); err != nil {
					log.Printf("[VAD] Deepgram send error: %v", err)
				}
			}
		}
	}()
}

// startLLMStage processes transcriptions and generates responses
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

				log.Printf("[STT] Transcript: %q (final=%v, speaker=%d)", transcript.Text, transcript.IsFinal, transcript.Speaker)

				// Add to aggregator
				fullText, isNewFinal := p.aggregator.Add(transcript)

				// Broadcast interim/final transcript for real-time display
				if fullText != "" {
					log.Printf("[WebSocket] Broadcasting transcript: %q", fullText)
					// Use speaker info if available
					if transcript.Speaker > 0 {
						p.overlay.Hub().BroadcastTranscriptWithSpeaker(fullText, transcript.Speaker)
					} else {
						p.overlay.Hub().BroadcastTranscript(fullText)
					}
				}

				// If we get a final transcript, log it
				if isNewFinal {
					log.Printf("[Aggregator] Final transcript ready: %q", fullText)
				}

			case <-p.utteranceEndCh:
				// Speaker finished talking (silence detected by Deepgram)
				log.Printf("[Turn] ⏹️ Utterance end detected - processing...")

				// Get the latest complete text
				pendingFullText := p.aggregator.GetFull()

				if pendingFullText == "" {
					log.Printf("[Turn] No text to process")
					continue
				}

				log.Printf("[LLM] 📤 Sending to LLM: %q", pendingFullText)

				// Add to context history
				p.addToHistory(pendingFullText, "interviewer", false)

				// Classify intent
				intentType := p.classifier.Classify(pendingFullText)
				log.Printf("[Intent] Clasificado como: %s", intentType)

				if !p.classifier.ShouldRespond(intentType) {
					log.Printf("[Intent] ⏭️ SKIPPING - no es pregunta técnica/behavioral")
					// Reset for next utterance
					p.aggregator.Reset()
					continue
				}

				log.Printf("[LLM] ✅ Enviando al LLM...")

				// Notify UI that we're thinking
				p.overlay.Hub().Broadcast(overlay.Message{
					Type:    "thinking",
					Content: "Analizando...",
				})

				// Send to LLM
				textToSend := pendingFullText
				go func() {
					log.Printf("[LLM] 🚀 Calling LLM client...")
					if err := p.llmClient.Send(p.ctx, textToSend, p.tokenCh); err != nil {
						log.Printf("[LLM] ❌ Error: %v", err)
						p.overlay.Hub().BroadcastError(err.Error())
					} else {
						log.Printf("[LLM] ✅ LLM call completed")
					}
				}()

				// Reset for next utterance
				p.aggregator.Reset()
			}
		}
	}()
}

// startOverlayStage broadcasts tokens to connected UI clients
func (p *Pipeline) startOverlayStage() {
	var fullResponse strings.Builder

	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		log.Printf("[OverlayStage] ✅ Started - waiting for tokens")
		for {
			select {
			case <-p.ctx.Done():
				return
			case token, ok := <-p.tokenCh:
				if !ok {
					return
				}

				log.Printf("[OverlayStage] 📥 Token received: %q (done=%v)", token.Content, token.Done)

				if token.Done {
					// Response complete
					log.Printf("[OverlayStage] ✅ Response complete, broadcasting: %d chars", fullResponse.Len())
					p.overlay.Hub().BroadcastToken("\n")
					p.overlay.Hub().Broadcast(overlay.Message{
						Type:    "done",
						Content: fullResponse.String(),
					})

					// Add to history
					if fullResponse.Len() > 0 {
						p.addToHistory(fullResponse.String(), "assistant", true)
					}
					fullResponse.Reset()
				} else {
					fullResponse.WriteString(token.Content)
					log.Printf("[OverlayStage] 📤 Broadcasting token: %q", token.Content)
					p.overlay.Hub().BroadcastToken(token.Content)
				}
			}
		}
	}()
}

// addToHistory adds an entry to the conversation context
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

// trimHistory removes entries older than maxHistoryAge
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
