import os
import logging
import requests
from typing import Any, Optional
import chromadb
from chromadb.config import Settings
from langchain_core.documents import Document


class OllamaEmbeddingsClient:
    """Client for Ollama Cloud embeddings API with proper auth"""
    
    def __init__(self, base_url: str, api_key: str, model: str = "nomic-embed-text"):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.model = model
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"[OllamaEmbeddings] API Key present: {bool(api_key)}, length: {len(api_key)}")
    
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        self.logger.info(f"[OllamaEmbeddings] embed_documents called with {len(texts)} texts")
        
        embeddings = []
        for text in texts:
            response = requests.post(
                f"{self.base_url}/api/embed",
                headers=headers,
                json={"model": self.model, "input": text},
                timeout=30
            )
            self.logger.info(f"[OllamaEmbeddings] Response status: {response.status_code}")
            self.logger.info(f"[OllamaEmbeddings] Response body: {response.text[:200]}")
            
            if response.status_code == 401:
                self.logger.error(f"[OllamaEmbeddings] 401 Unauthorized")
                raise Exception("401 Unauthorized")
            response.raise_for_status()
            embeddings.append(response.json()["embeddings"][0])
        
        return embeddings
    
    def embed_query(self, text: str) -> list[float]:
        """Embed a single query text"""
        return self.embed_documents([text])[0]


class VectorStore:
    def __init__(self, persist_directory: str = "./data/chroma"):
        self.persist_directory = persist_directory
        os.makedirs(persist_directory, exist_ok=True)
        
        api_key = os.getenv("OLLAMA_API_KEY", "")
        logger = logging.getLogger(__name__)
        logger.info(f"[VectorStore] API Key configured: {bool(api_key)}, length: {len(api_key)}")

        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )

        self.embedding_model = OllamaEmbeddingsClient(
            base_url=os.getenv("OLLAMA_BASE_URL", "https://ollama.com"),
            api_key=api_key,
            model="nomic-embed-text"
        )

        self.collection = self.client.get_or_create_collection(
            name="interview_docs",
            metadata={"hnsw:space": "cosine"}
        )

    async def add_documents(self, documents: list[Document], ids: Optional[list[str]] = None):
        if not documents:
            return

        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]
        doc_ids = ids or [f"doc_{i}" for i in range(len(texts))]

        embeddings = self.embedding_model.embed_documents(texts)

        self.collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=doc_ids,
            embeddings=embeddings
        )

    async def similarity_search(
        self,
        query: str,
        k: int = 4,
        filter: Optional[dict[str, Any]] = None
    ) -> list[Document]:
        query_embedding = self.embedding_model.embed_query(query)

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where=filter
        )

        documents = []
        if results["documents"]:
            for i, text in enumerate(results["documents"][0]):
                doc = Document(
                    page_content=text,
                    metadata=results["metadatas"][0][i] if results["metadatas"] else {}
                )
                documents.append(doc)

        return documents

    async def close(self):
        pass
