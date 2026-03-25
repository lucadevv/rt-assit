// Package llm provides prompt building for the LLM.
package llm

import (
	"fmt"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
)

// ContextEntry represents a single entry in the conversation context.
type ContextEntry struct {
	Text        string
	Speaker     string // "interviewer", "candidate", "assistant"
	Timestamp   time.Time
	IsAssistant bool
}

// ConversationContext holds the conversation history.
type ConversationContext struct {
	History []ContextEntry
}

// BuildPrompt constructs the messages for the LLM based on context and intent.
func BuildPrompt(ctx ConversationContext, intentType string) []openai.ChatCompletionMessage {
	var history strings.Builder

	for _, h := range ctx.History {
		if h.IsAssistant {
			history.WriteString(fmt.Sprintf("Asistente: %s\n", h.Text))
		} else {
			prefix := "Entrevistador"
			if h.Speaker == "candidate" {
				prefix = "Candidato"
			}
			history.WriteString(fmt.Sprintf("%s: %s\n", prefix, h.Text))
		}
	}

	systemPrompt := buildSystemPrompt(intentType)

	return []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
		{Role: openai.ChatMessageRoleUser, Content: buildUserPrompt(history.String())},
	}
}

func buildSystemPrompt(intentType string) string {
	basePrompt := `Eres un asistente invisible en una entrevista de trabajo técnica.
El usuario es el CANDIDATO. Tú escuchas al ENTREVISTADOR y ayudas al candidato.

REGLAS ABSOLUTAS:
1. Respuestas de MÁXIMO 2 oraciones cortas
2. NUNCA uses frases como "Creo que", "Podrías", "Quizás" - sé directo
3. NUNCA saludes ni respondas a small talk
4. NUNCA escribas código completo, solo pseudocódigo o lógica

`

	switch intentType {
	case "technical":
		return basePrompt + `Para preguntas TÉCNICAS:
- Concepto clave + ejemplo breve de código o uso
- Si es algoritmo: complejidad Big O + lógica principal
- Si es arquitectura: patrón + ventaja principal`
	case "behavioral":
		return basePrompt + `Para preguntas CONDUCTUALES:
- Menciona estructura STAR (Situación, Tarea, Acción, Resultado)
- Sugiere un ejemplo concreto que el candidato pueda usar
- Enfatiza resultados medibles`
	default:
		return basePrompt
	}
}

func buildUserPrompt(history string) string {
	return `CONVERSACIÓN ACTUAL:
` + history + `

Genera la mejor respuesta para ayudar al candidato. Sé conciso.`
}

// GetSystemPrompt returns the default system prompt.
func GetSystemPrompt() string {
	return `Eres un asistente invisible en una entrevista de trabajo técnica.
El usuario es el CANDIDATO. Tú escuchas al ENTREVISTADOR y ayudas al candidato.
Proporciona respuestas concisas, directas y útiles.
Máximo 2 oraciones por respuesta.`
}
