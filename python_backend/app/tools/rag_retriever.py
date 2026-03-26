from langchain_core.tools import tool


@tool
def retrieve_docs(query: str, k: int = 4) -> str:
    """Retrieve relevant documents from the knowledge base.

    Use this to find relevant information from previously uploaded documents.
    """
    return f"Retrieved {k} docs for: {query}"


rag_retriever_tool = retrieve_docs
