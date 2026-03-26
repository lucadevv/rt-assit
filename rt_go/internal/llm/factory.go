package llm

import (
	"fmt"

	"github.com/rtassist/rt_go/internal/ports"
)

func NewLLMClientFromConfig(cfg ports.LLMConfig) (ports.LLMPort, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("API key is required for all providers")
	}

	switch cfg.Provider {
	case ports.ProviderOpenAI:
		return NewOpenAIAdapter(cfg), nil
	case ports.ProviderOpenCode:
		return NewOpenCodeAdapter(cfg), nil
	case ports.ProviderGLM:
		return NewGLMAdapter(cfg), nil
	case ports.ProviderAnthropic:
		return NewAnthropicAdapter(cfg), nil
	case ports.ProviderGroq:
		return NewGroqAdapter(cfg), nil
	case ports.ProviderOllama:
		return NewOllamaAdapter(cfg), nil
	case ports.ProviderOllamaCloud:
		return NewOllamaCloudAdapter(cfg), nil
	case ports.ProviderAzure:
		return NewAzureAdapter(cfg), nil
	case ports.ProviderAWS:
		return NewAWSAdapter(cfg), nil
	case ports.ProviderVertex:
		return NewVertexAdapter(cfg), nil
	case ports.ProviderDeepSeek:
		return NewDeepSeekAdapter(cfg), nil
	case ports.ProviderMistral:
		return NewMistralAdapter(cfg), nil
	default:
		return NewOpenAIAdapter(cfg), nil
	}
}

func GetSupportedProviders() []string {
	return []string{
		ports.ProviderOpenAI,
		ports.ProviderOpenCode,
		ports.ProviderGLM,
		ports.ProviderAnthropic,
		ports.ProviderGroq,
		ports.ProviderOllama,
		ports.ProviderOllamaCloud,
		ports.ProviderAzure,
		ports.ProviderAWS,
		ports.ProviderVertex,
		ports.ProviderDeepSeek,
		ports.ProviderMistral,
	}
}

func GetDefaultConfig() ports.LLMConfig {
	return ports.LLMConfig{
		Model:      "gpt-4o-mini",
		Provider:   ports.ProviderOpenAI,
		MaxHistory: 20,
		Prompt:     "You are a helpful assistant during video calls.",
		BaseURL:    "https://api.openai.com/v1",
	}
}

func GetProviderModels(provider string) map[string]string {
	switch provider {
	case ports.ProviderOpenAI:
		return map[string]string{
			"gpt-4o":        "Latest GPT-4 Omni",
			"gpt-4o-mini":   "Fast & cheap GPT-4",
			"gpt-4":         "GPT-4",
			"gpt-3.5-turbo": "Legacy fast model",
		}
	case ports.ProviderOpenCode:
		return map[string]string{
			"gpt-5.2":           "GPT-5.2 (最新)",
			"gpt-5.2-codex":     "GPT-5.2 Codex",
			"gpt-4o-mini":       "GPT-4o Mini (高速)",
			"minimax-m2.1-free": "MiniMax M2.1 Free ( gratis)",
			"minimax-m2.1":      "MiniMax M2.1",
			"glm-4.7-free":      "GLM 4.7 Free ( gratis)",
			"glm-4.7":           "GLM 4.7",
			"kimi-k2.5-free":    "Kimi K2.5 Free ( gratis)",
			"kimi-k2.5":         "Kimi K2.5",
		}
	case ports.ProviderGLM:
		return map[string]string{
			"glm-4-flash":  "GLM-4 Flash (fast)",
			"glm-4-plus":   "GLM-4 Plus",
			"glm-4":        "GLM-4",
			"glm-4-vision": "GLM-4 Vision",
		}
	case ports.ProviderAnthropic:
		return map[string]string{
			"claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
			"claude-3-opus-20240229":     "Claude 3 Opus",
			"claude-3-haiku-20240307":    "Claude 3 Haiku",
		}
	case ports.ProviderGroq:
		return map[string]string{
			"llama-3.1-70b-versatile": "Llama 3.1 70B",
			"llama-3.1-8b-instant":    "Llama 3.1 8B",
			"mixtral-8x7b-32768":      "Mixtral 8x7B",
			"gemma2-9b-it":            "Gemma 2 9B",
		}
	case ports.ProviderOllama:
		return map[string]string{
			"llama3.1":      "Llama 3.1",
			"llama3":        "Llama 3",
			"mistral":       "Mistral",
			"codellama":     "Code Llama",
			"qwen2.5-coder": "Qwen 2.5 Coder",
		}
	case ports.ProviderOllamaCloud:
		return map[string]string{
			"glm-4.7":       "GLM 4.7",
			"glm-4":         "GLM 4",
			"llama3.1-70b":  "Llama 3.1 70B",
			"llama3.1-8b":   "Llama 3.1 8B",
			"qwen2.5-72b":   "Qwen 2.5 72B",
			"mistral-large": "Mistral Large",
		}
	case ports.ProviderAzure:
		return map[string]string{
			"gpt-4o":       "GPT-4 Omni",
			"gpt-4o-mini":  "GPT-4 Omni Mini",
			"gpt-4":        "GPT-4",
			"gpt-35-turbo": "GPT-3.5 Turbo",
		}
	case ports.ProviderAWS:
		return map[string]string{
			"anthropic.claude-3-5-sonnet-20241022-v2:0": "Claude 3.5 Sonnet",
			"anthropic.claude-3-opus-20240229-v1:0":     "Claude 3 Opus",
			"anthropic.claude-3-haiku-20240307-v1:0":    "Claude 3 Haiku",
			"meta.llama3-1-70b-instruct-v1:0":           "Llama 3.1 70B",
			"meta.llama3-1-8b-instruct-v1:0":            "Llama 3.1 8B",
		}
	case ports.ProviderVertex:
		return map[string]string{
			"gemini-2.0-flash-exp": "Gemini 2.0 Flash",
			"gemini-1.5-pro":       "Gemini 1.5 Pro",
			"gemini-1.5-flash":     "Gemini 1.5 Flash",
			"gemini-1.5-flash-8b":  "Gemini 1.5 Flash 8B",
		}
	case ports.ProviderDeepSeek:
		return map[string]string{
			"deepseek-chat":  "DeepSeek Chat",
			"deepseek-coder": "DeepSeek Coder",
		}
	case ports.ProviderMistral:
		return map[string]string{
			"mistral-large-latest":  "Mistral Large",
			"mistral-small-latest":  "Mistral Small",
			"mistral-medium-latest": "Mistral Medium",
		}
	default:
		return map[string]string{}
	}
}

func ValidateProvider(provider string) error {
	for _, p := range GetSupportedProviders() {
		if p == provider {
			return nil
		}
	}
	return fmt.Errorf("unsupported provider: %s", provider)
}
