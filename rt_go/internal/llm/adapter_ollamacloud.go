package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rtassist/rt_go/internal/ports"
)

// OllamaCloudAdapter connects to Ollama's cloud API (https://ollama.com/api)
type OllamaCloudAdapter struct {
	apiKey       string
	baseURL      string
	model        string
	systemPrompt string
	httpClient   *http.Client
	ctx          context.Context
	cancel       context.CancelFunc

	mu         sync.RWMutex
	messages   []ollamaMessage
	maxHistory int
}

type ollamaMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ollamaRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Stream   bool            `json:"stream"`
}

type ollamaResponse struct {
	Message       ollamaMessage `json:"message"`
	Done          bool          `json:"done"`
	Thinking      string        `json:"thinking,omitempty"`
	TotalDuration int64         `json:"total_duration,omitempty"`
}

func NewOllamaCloudAdapter(cfg ports.LLMConfig) *OllamaCloudAdapter {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://ollama.com/api"
	}

	adapter := &OllamaCloudAdapter{
		apiKey:       cfg.APIKey,
		baseURL:      baseURL,
		model:        cfg.Model,
		systemPrompt: cfg.Prompt,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		messages:   make([]ollamaMessage, 0),
		maxHistory: cfg.MaxHistory,
	}

	// Add system prompt as first message
	adapter.messages = []ollamaMessage{
		{Role: "system", Content: cfg.Prompt},
	}

	return adapter
}

func (a *OllamaCloudAdapter) Send(ctx interface{}, text string, tokenCh chan ports.LLMToken) error {
	if text == "" {
		return nil
	}

	goCtx, ok := ctx.(context.Context)
	if !ok {
		goCtx = context.Background()
	}

	a.mu.Lock()
	// Add user message
	a.messages = append(a.messages, ollamaMessage{
		Role:    "user",
		Content: text,
	})

	// Trim history if needed
	if len(a.messages) > a.maxHistory+1 {
		a.messages = append(
			[]ollamaMessage{a.messages[0]},
			a.messages[len(a.messages)-a.maxHistory:]...,
		)
	}

	messages := make([]ollamaMessage, len(a.messages))
	copy(messages, a.messages)
	a.mu.Unlock()

	// Build request
	reqBody := ollamaRequest{
		Model:    a.model,
		Messages: messages,
		Stream:   false, // Non-streaming for simplicity
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(goCtx, "POST", a.baseURL+"/chat", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if a.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("Ollama Cloud request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Ollama Cloud returned status %d: %s", resp.StatusCode, string(body))
	}

	// Decode response
	var ollamaResp ollamaResponse
	decoder := json.NewDecoder(resp.Body)

	var fullResponse strings.Builder

	// For non-streaming, we get the full response at once
	if err := decoder.Decode(&ollamaResp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	content := ollamaResp.Message.Content
	if content == "" && ollamaResp.Thinking != "" {
		// Sometimes thinking is in separate field
		content = ollamaResp.Thinking
	}

	if content != "" {
		fullResponse.WriteString(content)
		select {
		case tokenCh <- ports.LLMToken{Content: content, Done: false}:
		default:
		}
	}

	select {
	case tokenCh <- ports.LLMToken{Done: true}:
	default:
	}

	a.mu.Lock()
	a.messages = append(a.messages, ollamaMessage{
		Role:    "assistant",
		Content: fullResponse.String(),
	})
	a.mu.Unlock()

	return nil
}

func (a *OllamaCloudAdapter) Stop() error {
	if a.cancel != nil {
		a.cancel()
	}
	return nil
}

func (a *OllamaCloudAdapter) IsConnected() bool {
	return a.httpClient != nil
}
