package llm

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/rtassist/rt_go/internal/ports"
	"github.com/sashabaranov/go-openai"
)

type VertexAdapter struct {
	apiKey       string
	project      string
	location     string
	model        string
	systemPrompt string
	client       *openai.Client
	ctx          context.Context
	cancel       context.CancelFunc

	mu         sync.RWMutex
	messages   []openai.ChatCompletionMessage
	maxHistory int
}

func NewVertexAdapter(cfg ports.LLMConfig) *VertexAdapter {
	location := cfg.Region
	if location == "" {
		location = "us-central1"
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1", location)
	}

	config := openai.DefaultConfig(cfg.APIKey)
	config.BaseURL = baseURL

	adapter := &VertexAdapter{
		apiKey:       cfg.APIKey,
		location:     location,
		model:        cfg.Model,
		systemPrompt: cfg.Prompt,
		client:       openai.NewClientWithConfig(config),
		messages:     make([]openai.ChatCompletionMessage, 0),
		maxHistory:   cfg.MaxHistory,
	}

	adapter.messages = []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: cfg.Prompt},
	}

	return adapter
}

func (a *VertexAdapter) Send(ctx interface{}, text string, tokenCh chan ports.LLMToken) error {
	if text == "" {
		return nil
	}

	goCtx, ok := ctx.(context.Context)
	if !ok {
		goCtx = context.Background()
	}

	a.mu.Lock()
	a.messages = append(a.messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: text,
	})

	if len(a.messages) > a.maxHistory+1 {
		a.messages = append(
			[]openai.ChatCompletionMessage{a.messages[0]},
			a.messages[len(a.messages)-a.maxHistory:]...,
		)
	}

	messages := make([]openai.ChatCompletionMessage, len(a.messages))
	copy(messages, a.messages)
	a.mu.Unlock()

	req := openai.ChatCompletionRequest{
		Model:    a.model,
		Messages: messages,
		Stream:   true,
	}

	stream, err := a.client.CreateChatCompletionStream(goCtx, req)
	if err != nil {
		return fmt.Errorf("Google Vertex stream error: %w", err)
	}
	defer stream.Close()

	var fullResponse strings.Builder

	for {
		response, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				break
			}
			return fmt.Errorf("Google Vertex stream recv error: %w", err)
		}

		if len(response.Choices) == 0 {
			continue
		}

		content := response.Choices[0].Delta.Content
		if content == "" {
			continue
		}

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
	a.messages = append(a.messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleAssistant,
		Content: fullResponse.String(),
	})
	a.mu.Unlock()

	return nil
}

func (a *VertexAdapter) Stop() error {
	if a.cancel != nil {
		a.cancel()
	}
	return nil
}

func (a *VertexAdapter) IsConnected() bool {
	return a.client != nil
}
