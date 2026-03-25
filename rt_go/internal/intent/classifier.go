// Package intent classifies the intent of transcribed text.
package intent

import (
	"strings"
)

// Type represents the classified intent type.
type Type string

const (
	TypeTechnical  Type = "technical"
	TypeBehavioral Type = "behavioral"
	TypeSmallTalk  Type = "small_talk"
	TypeUnknown    Type = "unknown"
)

// Classifier determines the intent of transcribed speech.
type Classifier struct {
	techPatterns       []string
	behavioralPatterns []string
	smallTalkPatterns  []string
}

// NewClassifier creates a new intent classifier.
func NewClassifier() *Classifier {
	return &Classifier{
		techPatterns: []string{
			// General technical
			"what is", "how does", "explain", "difference between",
			"pros and cons", "advantages", "disadvantages", "compare",
			"implement", "optimize", "scale", "architecture",
			"qué es", "cómo funciona", "explica", "diferencia entre",
			"ventajas", "desventajas", "implementa", "optimiza",
			"escalabilidad", "arquitectura", "patrón de diseño",

			// Programming specific
			"closure", "async", "await", "promise", "callback",
			"recursion", "inheritance", "polymorphism", "encapsulation",
			"database", "query", "index", "cache", "redis", "sql",
			"microservice", "monolith", "api", "rest", "graphql",
			"docker", "kubernetes", "ci/cd", "testing", "unit test",
			"algorithm", "complexity", "big o", "data structure",
			"memory leak", "garbage collection", "thread", "process",
			"concurrency", "parallelism", "deadlock", "race condition",
			"react", "angular", "vue", "node", "typescript", "javascript",
			"go", "golang", "python", "rust", "java", "c++",
		},
		behavioralPatterns: []string{
			"tell me about", "describe a time", "give me an example",
			"how would you handle", "what would you do", "tell me about a situation",
			"cuéntame sobre", "describe una vez", "cómo manejarías",
			"qué harías", "cuéntame de una situación", "ejemplo de",
			"conflict", "challenge", "difficult situation", "teamwork",
			"deadline", "pressure", "mistake", "failure", "success",
			"leadership", "mentoring", "collaboration", "stakeholder",
		},
		smallTalkPatterns: []string{
			"hello", "hi", "good morning", "good afternoon", "good evening",
			"how are you", "how do you do", "nice to meet you", "pleased to meet you",
			"thank you", "thanks", "welcome", "goodbye", "bye",
			"hola", "buenos días", "buenas tardes", "buenas noches",
			"cómo estás", "qué tal", "gusto en conocerte", "mucho gusto",
			"gracias", "bienvenido", "empezamos", "comenzamos",
			"how's it going", "what's up", "how have you been",
		},
	}
}

// Classify determines the intent type of the given text.
func (c *Classifier) Classify(text string) Type {
	lower := strings.ToLower(text)

	// 1. Detect small talk first (discard these)
	for _, pattern := range c.smallTalkPatterns {
		if strings.Contains(lower, pattern) {
			return TypeSmallTalk
		}
	}

	// 2. Detect technical questions
	for _, pattern := range c.techPatterns {
		if strings.Contains(lower, pattern) {
			return TypeTechnical
		}
	}

	// 3. Detect behavioral questions
	for _, pattern := range c.behavioralPatterns {
		if strings.Contains(lower, pattern) {
			return TypeBehavioral
		}
	}

	// 4. Heuristic: if ends with ? and is short, probably technical
	if strings.HasSuffix(lower, "?") && len(text) < 150 {
		return TypeTechnical
	}

	return TypeUnknown
}

// ShouldRespond returns true if the intent type warrants a response.
func (c *Classifier) ShouldRespond(t Type) bool {
	return t == TypeTechnical || t == TypeBehavioral
}

// String returns the string representation of the intent type.
func (t Type) String() string {
	return string(t)
}
