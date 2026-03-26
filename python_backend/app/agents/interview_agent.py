import os
import logging
from typing import Any, Optional, Union, List
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.memory.vector_store import VectorStore
from app.memory.conversation import ConversationMemory


logger = logging.getLogger(__name__)


class OllamaCloudChat:
    """Simple Ollama Cloud LLM wrapper"""
    
    model: str = "glm-4.7"
    base_url: str = "https://ollama.com"
    api_key: str = ""
    temperature: float = 0.7
    
    def __init__(self, model: str, base_url: str, api_key: str, temperature: float = 0.7):
        self.model = model
        self.base_url = base_url
        self.api_key = api_key
        self.temperature = temperature
    
    def invoke(self, messages: List[Any]) -> Any:
        import requests
        
        def to_role(m):
            t = type(m).__name__
            if t == "HumanMessage":
                return "user"
            elif t == "AIMessage":
                return "assistant"
            return "user"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "messages": [{"role": to_role(m), "content": m.content} for m in messages],
            "stream": False,
            "temperature": self.temperature,
        }
        
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=payload,
            headers=headers,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        
        content = data["message"]["content"]
        return SimpleAIMessage(content=content)


class SimpleAIMessage:
    def __init__(self, content: str):
        self.content = content


class InterviewState(dict):
    transcript: str
    response: Optional[str]


def get_llm():
    return OllamaCloudChat(
        model=os.getenv("LLM_MODEL", "minimax-m2.5:cloud"),
        base_url=os.getenv("OLLAMA_BASE_URL", "https://ollama.com"),
        api_key=os.getenv("OLLAMA_API_KEY", ""),
        temperature=0.7,
    )


class InterviewAgent:
    def __init__(
        self,
        vector_store: VectorStore,
        conversation_memory: ConversationMemory,
        session_id: str = "default"
    ):
        self.vector_store = vector_store
        self.conversation_memory = conversation_memory
        self.session_id = session_id

        self.llm = get_llm()
        
        self._build_graph()

    def _generate_response(self, state: InterviewState) -> InterviewState:
        transcript = state.get("transcript", "")
        
        conversation = self.conversation_memory.get_recent(self.session_id, n=6)
        conversation_context = "\n".join([
            f"{m.role}: {m.content}" for m in conversation
        ])
        
        prompt = f"""You are an AI interview assistant helping a candidate during a technical interview.

Recent conversation:
{conversation_context}

Interviewer said: {transcript}

Provide a helpful, brief response (1-2 sentences):"""

        messages = [
            SystemMessage(content="You are a helpful interview assistant. Keep responses short and helpful."),
            HumanMessage(content=prompt)
        ]

        response = self.llm.invoke(messages)
        state["response"] = response.content.strip()
        logger.info(f"[Agent] Generated response: {state['response'][:50]}...")
        return state

    def _store_conversation(self, state: InterviewState) -> InterviewState:
        transcript = state.get("transcript", "")
        response = state.get("response")

        self.conversation_memory.add_message(self.session_id, "interviewer", transcript)

        if response:
            self.conversation_memory.add_message(self.session_id, "assistant", response)

        return state

    def _build_graph(self):
        workflow = StateGraph(InterviewState)

        workflow.add_node("generate_response", self._generate_response)
        workflow.add_node("store_conversation", self._store_conversation)

        workflow.set_entry_point("generate_response")
        workflow.add_edge("generate_response", "store_conversation")
        workflow.add_edge("store_conversation", END)

        self.graph = workflow.compile()

    async def process_transcript(self, transcript: str, is_final: bool = True) -> Optional[str]:
        initial_state: InterviewState = {
            "transcript": transcript,
            "response": None,
        }

        result = await self.graph.ainvoke(initial_state)
        return result.get("response")