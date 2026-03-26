package ports

type LLMToken struct {
	Content string
	Done    bool
}

type LLMConfig struct {
	APIKey     string
	BaseURL    string
	Model      string
	Prompt     string
	Provider   string
	MaxHistory int
	Region     string
}

type LLMResponse struct {
	Content string
	Error   error
}

type LLMPort interface {
	Send(ctx interface{}, text string, tokenCh chan LLMToken) error
	Stop() error
	IsConnected() bool
}

const (
	ProviderOpenAI      = "openai"
	ProviderOpenCode    = "opencode"
	ProviderGLM         = "glm"
	ProviderAnthropic   = "anthropic"
	ProviderGroq        = "groq"
	ProviderOllama      = "ollama"      // Local: http://localhost:11434/v1
	ProviderOllamaCloud = "ollamacloud" // Cloud: https://ollama.com/api
	ProviderAzure       = "azure"
	ProviderAWS         = "aws"
	ProviderVertex      = "vertex"
	ProviderDeepSeek    = "deepseek"
	ProviderMistral     = "mistral"
)
