// Package llm provides streaming LLM inference via OpenAI-compatible API.
package llm

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/rtassist/rt_go/internal/ports"
	"github.com/sashabaranov/go-openai"
)

type Token = ports.LLMToken

type LLMConfig struct {
	APIKey       string
	BaseURL      string
	Model        string
	SystemPrompt string
	MaxHistory   int
	Provider     string
}

type LLMClient struct {
	apiKey       string
	baseURL      string
	model        string
	systemPrompt string
	client       *openai.Client
	ctx          context.Context
	cancel       context.CancelFunc

	mu         sync.RWMutex
	messages   []openai.ChatCompletionMessage
	maxHistory int
}

func NewLLMClient(cfg LLMConfig) *LLMClient {
	config := openai.DefaultConfig(cfg.APIKey)
	if cfg.BaseURL != "" {
		config.BaseURL = cfg.BaseURL
	}

	return &LLMClient{
		apiKey:       cfg.APIKey,
		baseURL:      cfg.BaseURL,
		model:        cfg.Model,
		systemPrompt: cfg.SystemPrompt,
		client:       openai.NewClientWithConfig(config),
		messages:     make([]openai.ChatCompletionMessage, 0),
		maxHistory:   cfg.MaxHistory,
	}
}

func DefaultLLMConfig() LLMConfig {
	return LLMConfig{
		Model:        "glm-4-flash",
		SystemPrompt: "You are a helpful assistant during video calls. Provide concise, relevant answers.",
		MaxHistory:   20,
	}
}

// Start initializes the LLM context.
func (c *LLMClient) Start(ctx context.Context) error {
	c.ctx, c.cancel = context.WithCancel(ctx)

	// Initialize with system prompt
	c.mu.Lock()
	c.messages = []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: c.systemPrompt,
		},
	}
	c.mu.Unlock()

	return nil
}

// Stop closes the LLM context.
func (c *LLMClient) Stop() {
	if c.cancel != nil {
		c.cancel()
	}
}

func (c *LLMClient) IsConnected() bool {
	return c.client != nil
}

// ClearHistory clears the conversation history.
func (c *LLMClient) ClearHistory() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.messages = []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: c.systemPrompt,
		},
	}
}

// Send sends a transcript to the LLM and streams tokens.
func (c *LLMClient) Send(ctx context.Context, transcript string, tokenCh chan<- Token) error {
	if transcript == "" {
		return nil
	}

	c.mu.Lock()
	// Add user message
	c.messages = append(c.messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: transcript,
	})

	// Trim history if needed
	if len(c.messages) > c.maxHistory+1 { // +1 for system prompt
		// Keep system prompt and last N messages
		c.messages = append(
			[]openai.ChatCompletionMessage{c.messages[0]},
			c.messages[len(c.messages)-c.maxHistory:]...,
		)
	}

	messages := make([]openai.ChatCompletionMessage, len(c.messages))
	copy(messages, c.messages)
	c.mu.Unlock()

	// Create streaming request
	req := openai.ChatCompletionRequest{
		Model:    c.model,
		Messages: messages,
		Stream:   true,
	}

	stream, err := c.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return fmt.Errorf("LLM stream error: %w", err)
	}
	defer stream.Close()

	var fullResponse strings.Builder

	for {
		select {
		case <-c.ctx.Done():
			return c.ctx.Err()
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		response, err := stream.Recv()
		if err != nil {
			if err.Error() == "EOF" {
				// Stream finished
				break
			}
			return fmt.Errorf("LLM stream recv error: %w", err)
		}

		if len(response.Choices) == 0 {
			continue
		}

		content := response.Choices[0].Delta.Content
		if content == "" {
			continue
		}

		fullResponse.WriteString(content)

		token := Token{
			Content: content,
			Done:    false,
		}

		select {
		case tokenCh <- token:
		default:
		}
	}

	select {
	case tokenCh <- Token{Done: true}:
	default:
	}

	// Add assistant response to history
	c.mu.Lock()
	c.messages = append(c.messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleAssistant,
		Content: fullResponse.String(),
	})
	c.mu.Unlock()

	return nil
}

// SendAsync sends a transcript and streams tokens in a goroutine.
func (c *LLMClient) SendAsync(ctx context.Context, transcript string, tokenCh chan<- Token, errCh chan<- error) {
	go func() {
		if err := c.Send(ctx, transcript, tokenCh); err != nil {
			select {
			case errCh <- err:
			default:
			}
		}
	}()
}

// GetHistory returns the current conversation history.
func (c *LLMClient) GetHistory() []openai.ChatCompletionMessage {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make([]openai.ChatCompletionMessage, len(c.messages))
	copy(result, c.messages)
	return result
}

// SetSystemPrompt updates the system prompt.
func (c *LLMClient) SetSystemPrompt(prompt string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.systemPrompt = prompt
	if len(c.messages) > 0 {
		c.messages[0].Content = prompt
	}
}

// TestConnection tests the LLM connection with a simple request.
func (c *LLMClient) TestConnection(ctx context.Context) error {
	_, err := c.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: c.model,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "ping"},
		},
		MaxTokens: 5,
	})
	if err != nil {
		return fmt.Errorf("LLM connection test failed: %w", err)
	}

	log.Println("LLM connection test successful")
	return nil
}
