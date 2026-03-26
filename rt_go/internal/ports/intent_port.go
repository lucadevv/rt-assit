// Package ports defines the interfaces (ports) for hexagonal architecture.
// These interfaces separate the application core from external dependencies.
package ports

// Transcript represents a speech-to-text result
// Status represents the intent classification
type IntentType string

const (
	IntentTechnical  IntentType = "technical"
	IntentBehavioral IntentType = "behavioral"
	IntentSmallTalk  IntentType = "small_talk"
	IntentUnknown    IntentType = "unknown"
)

type IntentPort interface {
	Classify(text string) IntentType
	ShouldRespond(IntentType) bool
}
