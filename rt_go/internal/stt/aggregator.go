package stt

import (
	"strings"
	"sync"
)

type TranscriptAggregator struct {
	current strings.Builder // Current utterance being built
	mu      sync.Mutex
}

func NewTranscriptAggregator() *TranscriptAggregator {
	return &TranscriptAggregator{}
}

func (a *TranscriptAggregator) Add(msg Transcript) (fullText string, isNewFinal bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if msg.IsFinal {
		// Final transcript - replace current with this complete text
		a.current.Reset()
		a.current.WriteString(msg.Text)

		// Clean up the text
		cleanText := a.cleanText(a.current.String())
		return cleanText, true
	}

	// Interim - update current but don't signal new final
	a.current.Reset()
	a.current.WriteString(msg.Text)
	return "", false
}

func (a *TranscriptAggregator) cleanText(text string) string {
	// Remove repeated words like "Hola, hola. Hola, hola."
	words := strings.Fields(text)
	if len(words) == 0 {
		return ""
	}

	// Simple deduplication: if same word appears 3+ times in a row, remove duplicates
	var cleaned []string
	var repeatCount int
	var lastWord string

	for _, word := range words {
		lower := strings.ToLower(word)
		if lower == lastWord {
			repeatCount++
			if repeatCount <= 2 { // Keep first 2 occurrences
				cleaned = append(cleaned, word)
			}
		} else {
			repeatCount = 0
			cleaned = append(cleaned, word)
		}
		lastWord = lower
	}

	result := strings.Join(cleaned, " ")

	// Add space after punctuation if missing
	result = strings.ReplaceAll(result, ".", ". ")
	result = strings.ReplaceAll(result, ",", ", ")
	result = strings.ReplaceAll(result, "  ", " ")

	return strings.TrimSpace(result)
}

func (a *TranscriptAggregator) GetFull() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.current.String()
}

func (a *TranscriptAggregator) Reset() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.current.Reset()
}
