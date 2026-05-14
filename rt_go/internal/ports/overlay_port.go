package ports

type UIMessage struct {
	Type    string
	Content string
	Token   string
}

type OverlayPort interface {
	Broadcast(UIMessage)
	BroadcastTranscript(text string, isFinal bool, speaker int)
	BroadcastToken(token string)
	BroadcastThinking()
	BroadcastError(err string)
	Hub() interface{}
}
