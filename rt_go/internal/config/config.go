// Package config provides centralized configuration management.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration for rtassist.
type Config struct {
	// Chrome CDP
	ChromePort int

	// Deepgram STT
	DeepgramAPIKey string

	// LLM
	LLMAPIKey  string
	LLMBaseURL string
	LLMModel   string

	// Overlay WebSocket
	OverlayPort int

	// Audio Receiver from Chrome Extension
	AudioRecvPort int

	// Audio Processing
	VADThreshold    float64
	VADSilenceMs    int
	MaxUtteranceSec int

	// System
	SystemPrompt string
}

// Load reads configuration from environment variables and defaults.
func Load() (*Config, error) {
	cfg := &Config{
		// Chrome CDP
		ChromePort: getEnvInt("CHROME_PORT", 9222),

		// Deepgram
		DeepgramAPIKey: getEnv("DEEPGRAM_API_KEY", ""),

		// LLM
		LLMAPIKey:  getEnv("LLM_API_KEY", ""),
		LLMBaseURL: getEnv("LLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4"),
		LLMModel:   getEnv("LLM_MODEL", "glm-4-flash"),

		// Overlay
		OverlayPort: getEnvInt("OVERLAY_PORT", 8765),

		// Audio Receiver (for Chrome Extension)
		AudioRecvPort: getEnvInt("AUDIO_RECV_PORT", 8766),

		// Audio
		VADThreshold:    getEnvFloat("VAD_THRESHOLD", 0.03),
		VADSilenceMs:    getEnvInt("VAD_SILENCE_MS", 600),
		MaxUtteranceSec: getEnvInt("MAX_UTTERANCE_SEC", 10),

		// System
		SystemPrompt: getEnv("SYSTEM_PROMPT", DefaultSystemPrompt),
	}

	// Validate required fields
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate checks that all required configuration is present.
func (c *Config) Validate() error {
	if c.DeepgramAPIKey == "" || c.DeepgramAPIKey == "your_deepgram_api_key_here" {
		return fmt.Errorf("DEEPGRAM_API_KEY is required. Set it in .env file")
	}
	if c.LLMAPIKey == "" || c.LLMAPIKey == "your_llm_api_key_here" {
		return fmt.Errorf("LLM_API_KEY is required. Set it in .env file")
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
		"Config{ChromePort: %d, OverlayPort: %d, AudioRecvPort: %d, LLMModel: %s, LLMBaseURL: %s}",
		c.ChromePort,
		c.OverlayPort,
		c.AudioRecvPort,
		c.LLMModel,
		c.LLMBaseURL,
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
