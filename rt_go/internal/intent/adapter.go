package intent

import "github.com/rtassist/rt_go/internal/ports"

func (c *Classifier) ClassifyAsPort(text string) ports.IntentType {
	result := c.Classify(text)
	return ports.IntentType(result)
}

func (c *Classifier) ShouldRespondAsPort(t ports.IntentType) bool {
	return c.ShouldRespond(Type(t))
}
