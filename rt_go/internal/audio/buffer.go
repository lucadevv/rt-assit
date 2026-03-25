// Package audio provides audio buffering for utterance segmentation.
package audio

import (
	"sync"
	"time"
)

// Buffer accumulates audio chunks until an utterance is complete.
type Buffer struct {
	mu     sync.Mutex
	chunks []AudioChunk
	maxDur time.Duration
}

// NewBuffer creates a new audio buffer.
func NewBuffer() *Buffer {
	return &Buffer{
		chunks: make([]AudioChunk, 0),
		maxDur: MaxUtteranceDuration,
	}
}

// Add adds a chunk to the buffer.
func (b *Buffer) Add(chunk AudioChunk) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.chunks = append(b.chunks, chunk)
}

// Reset clears the buffer and returns accumulated audio.
func (b *Buffer) Reset() Utterance {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.chunks) == 0 {
		return Utterance{}
	}

	var totalSize int
	for _, c := range b.chunks {
		totalSize += len(c.Data)
	}

	audio := make([]byte, 0, totalSize)
	var start, end time.Time

	for _, c := range b.chunks {
		if start.IsZero() {
			start = c.Timestamp
		}
		end = c.Timestamp
		audio = append(audio, c.Data...)
	}

	b.chunks = b.chunks[:0]

	return Utterance{
		Audio:    audio,
		Duration: end.Sub(start),
	}
}

// Size returns the number of chunks in the buffer.
func (b *Buffer) Size() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.chunks)
}

// Duration returns the total duration of buffered audio.
func (b *Buffer) Duration() time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.chunks) == 0 {
		return 0
	}

	start := b.chunks[0].Timestamp
	end := b.chunks[len(b.chunks)-1].Timestamp
	return end.Sub(start)
}

// IsEmpty returns true if the buffer has no chunks.
func (b *Buffer) IsEmpty() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.chunks) == 0
}
