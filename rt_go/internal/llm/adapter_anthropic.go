package llm

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/rtassist/rt_go/internal/ports"
)

type AnthropicAdapter struct {
	apiKey       string
	model        string
	systemPrompt string
	httpClient   *http.Client
	ctx          context.Context
	cancel       context.CancelFunc
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func NewAnthropicAdapter(cfg ports.LLMConfig) *AnthropicAdapter {
	return &AnthropicAdapter{
		apiKey:       cfg.APIKey,
		model:        cfg.Model,
		systemPrompt: cfg.Prompt,
		httpClient:   &http.Client{},
	}
}

func (a *AnthropicAdapter) Send(ctx interface{}, text string, tokenCh chan ports.LLMToken) error {
	if text == "" {
		return nil
	}

	goCtx, ok := ctx.(context.Context)
	if !ok {
		goCtx = context.Background()
	}

	messages := []anthropicMessage{
		{Role: "system", Content: a.systemPrompt},
		{Role: "user", Content: text},
	}

	jsonBody, _ := json.Marshal(map[string]interface{}{
		"model":      a.model,
		"messages":   messages,
		"max_tokens": 4096,
		"stream":     true,
	})

	req, err := http.NewRequestWithContext(goCtx, "POST",
		"https://api.anthropic.com/v1/messages", strings.NewReader(string(jsonBody)))
	if err != nil {
		return fmt.Errorf("Anthropic request error: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("Anthropic HTTP error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := bufio.NewReader(resp.Body).ReadString('\n')
		return fmt.Errorf("Anthropic API error: %s", body)
	}

	scanner := bufio.NewScanner(resp.Body)
	var fullResponse strings.Builder

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var event map[string]interface{}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		if delta, ok := event["delta"].(map[string]interface{}); ok {
			if text, ok := delta["text"].(string); ok {
				fullResponse.WriteString(text)
				select {
				case tokenCh <- ports.LLMToken{Content: text, Done: false}:
				default:
				}
			}
		}
	}

	select {
	case tokenCh <- ports.LLMToken{Done: true}:
	default:
	}

	return nil
}

func (a *AnthropicAdapter) Stop() error {
	if a.cancel != nil {
		a.cancel()
	}
	return nil
}

func (a *AnthropicAdapter) IsConnected() bool {
	return a.httpClient != nil
}
