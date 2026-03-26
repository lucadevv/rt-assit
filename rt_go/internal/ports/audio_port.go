package ports

type AudioChunk struct {
	Data       []byte
	Format     string
	SampleRate int
	Channels   int
}

type AudioReceiverPort interface {
	Start(ctx interface{}) error
	Stop() error
	OnChunk(func(AudioChunk))
}
