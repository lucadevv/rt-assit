package ports

import "time"

type Transcript struct {
	Text       string
	StartTime  time.Time
	EndTime    time.Time
	Confidence float64
	IsFinal    bool
}

type STTPort interface {
	Start(ctx interface{}, config interface{}) error
	Send(audio []byte) error
	SendFinalize() error
	Stop() error
	IsConnected() bool
	OnTranscript(func(Transcript))
}
