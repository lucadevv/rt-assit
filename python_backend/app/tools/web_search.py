from typing import Any
from langchain_core.tools import tool
import httpx


@tool
def web_search(query: str) -> str:
    """Search the web for current information about a topic.

    Use this when you need up-to-date information or don't know something.
    """
    return f"Search result for: {query}"


web_search_tool = web_search
