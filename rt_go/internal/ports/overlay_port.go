package ports

type UIMessage struct {
	Type    string
	Content string
	Token   string
}

type OverlayPort interface {
	Broadcast(UIMessage)
	BroadcastTranscript(text string)
	BroadcastToken(token string)
	BroadcastThinking()
	BroadcastError(err string)
	Hub() interface{}
}
