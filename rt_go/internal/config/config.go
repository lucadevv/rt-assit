// Package config provides centralized configuration management.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration for rtassist.
type Config struct {
	// Deepgram STT
	DeepgramAPIKey string

	// Overlay WebSocket (for clients - macOS app)
	OverlayPort int

	// Audio Receiver from Chrome Extension
	AudioRecvPort int

	// Audio Processing
	VADThreshold    float64
	VADSilenceMs    int
	MaxUtteranceSec int
}

// Load reads configuration from environment variables and defaults.
func Load() (*Config, error) {
	cfg := &Config{
		// Deepgram
		DeepgramAPIKey: getEnv("DEEPGRAM_API_KEY", ""),

		// Overlay WebSocket (for clients)
		OverlayPort: getEnvInt("OVERLAY_PORT", 8765),

		// Audio Receiver (for Chrome Extension)
		AudioRecvPort: getEnvInt("AUDIO_RECV_PORT", 8766),

		// Audio Processing
		VADThreshold:    getEnvFloat("VAD_THRESHOLD", 0.03),
		VADSilenceMs:    getEnvInt("VAD_SILENCE_MS", 600),
		MaxUtteranceSec: getEnvInt("MAX_UTTERANCE_SEC", 10),
	}

	// Validate required fields
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func getDefaultBaseURL(provider string) string {
	switch provider {
	case "openai":
		return "https://api.openai.com/v1"
	case "opencode":
		return "https://opencode.ai/zen/v1"
	case "glm":
		return "https://open.bigmodel.cn/api/paas/v4"
	case "anthropic":
		return "https://api.anthropic.com"
	case "groq":
		return "https://api.groq.com/openai/v1"
	case "deepseek":
		return "https://api.deepseek.com/v1"
	case "mistral":
		return "https://api.mistral.ai/v1"
	case "ollama":
		return "http://localhost:11434/v1"
	case "ollamacloud":
		return "https://ollama.com/api"
	case "azure":
		return "https://<resource>.openai.azure.com/openai/v1"
	case "aws":
		return "https://bedrock-runtime.us-east-1.amazonaws.com"
	case "vertex":
		return "https://us-central1-aiplatform.googleapis.com/v1"
	default:
		return "https://api.openai.com/v1"
	}
}

func getDefaultModel(provider string) string {
	switch provider {
	case "openai":
		return "gpt-4o-mini"
	case "opencode":
		return "gpt-4o-mini"
	case "glm":
		return "glm-4-flash"
	case "anthropic":
		return "claude-3-5-sonnet-20241022"
	case "groq":
		return "llama-3.1-70b-versatile"
	case "deepseek":
		return "deepseek-chat"
	case "mistral":
		return "mistral-small-latest"
	case "ollama":
		return "llama3.1"
	case "ollamacloud":
		return "glm-4.7"
	default:
		return "gpt-4o-mini"
	}
}

// Validate checks that all required configuration is present.
func (c *Config) Validate() error {
	if c.DeepgramAPIKey == "" || c.DeepgramAPIKey == "your_deepgram_api_key_here" {
		return fmt.Errorf("DEEPGRAM_API_KEY is required. Set it in .env file")
	}
	return nil
}

// DefaultSystemPrompt is the default prompt for interview assistance.
const DefaultSystemPrompt = `Eres un asistente invisible en una entrevista de trabajo técnica.
El usuario es el CANDIDATO. Tú escuchas al ENTREVISTADOR y ayudas al candidato.

REGLAS ABSOLUTAS:
1. Respuestas de MÁXIMO 2 oraciones cortas
2. Si es técnica: concepto clave + ejemplo breve de código o uso
3. Si es conductual: mencionar estructura STAR (Situación, Tarea, Acción, Resultado)
4. NUNCA uses frases como "Creo que", "Podrías", "Quizás" - sé directo
5. NUNCA saludes ni respondas a small talk
6. NUNCA escribas código completo, solo pseudocódigo o lógica`

// String returns a safe string representation (without secrets).
func (c *Config) String() string {
	return fmt.Sprintf(
		"Config{OverlayPort: %d, AudioRecvPort: %d}",
		c.OverlayPort,
		c.AudioRecvPort,
	)
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if f, err := strconv.ParseFloat(value, 64); err == nil {
			return f
		}
	}
	return defaultValue
}
