"""LLM factory: pick provider from env.

Selection order:
  1. ``LLM_PROVIDER`` (explicit switch) — values: ``glm``, ``groq``,
     ``ollama_cloud``, ``failover``. When set, we honour it strictly and
     raise if the matching credentials are missing (so misconfiguration
     fails fast).
  2. Otherwise, fall back to credential-presence detection (legacy):
     Groq preferred when GROQ_API_KEY is set, else Ollama Cloud when
     OLLAMA_API_KEY is set. This keeps existing deploys unaffected.

``failover`` mode wraps two providers: ``LLM_PRIMARY`` (default
``ollama_cloud``) is tried first; on transient errors (timeout / 5xx /
429) BEFORE any token is emitted, ``LLM_FAILOVER`` (default ``glm``) is
used instead. See ``failover_client.py`` for details.
"""
import logging
import os
from typing import Optional

from app.application.ports.llm_provider import LLMProvider
from app.infrastructure.llm.failover_client import FailoverLLMClient
from app.infrastructure.llm.glm_client import GLMClient
from app.infrastructure.llm.groq_client import GroqClient
from app.infrastructure.llm.ollama_cloud_client import OllamaCloudClient


logger = logging.getLogger(__name__)


DEFAULT_TEMPERATURE = 0.5

# Concrete provider names accepted as building blocks (single-provider
# branches AND failover children).
_CONCRETE_PROVIDERS = {"glm", "groq", "ollama_cloud"}


def _build_glm() -> LLMProvider:
    """GLM (Z.ai) — OpenAI-compatible. Free tier (glm-4.5-flash) recommended.

    Requires ``Z_AI_API_KEY``. Optional: ``GLM_MODEL`` (default
    ``glm-4.5-flash``), ``GLM_BASE_URL`` (default
    ``https://api.z.ai/api/paas/v4``).
    """
    api_key = os.getenv("Z_AI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "LLM_PROVIDER=glm but Z_AI_API_KEY is missing. Set it in the "
            "shell env or the docker-compose root-level .env."
        )
    model = os.getenv("GLM_MODEL", "glm-4.5-flash")
    base_url = os.getenv("GLM_BASE_URL", "https://api.z.ai/api/paas/v4")
    # NEVER log api_key. Model + base_url are safe.
    logger.info("[LLM] Using GLM %s @ %s", model, base_url)
    return GLMClient(
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=float(os.getenv("LLM_TEMPERATURE", str(DEFAULT_TEMPERATURE))),
        timeout=float(os.getenv("LLM_TIMEOUT", "60.0")),
    )


def _build_groq() -> LLMProvider:
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if not groq_key:
        raise RuntimeError(
            "LLM_PROVIDER=groq but GROQ_API_KEY is missing."
        )
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    logger.info("[LLM] Using Groq %s (GROQ_API_KEY present)", model)
    return GroqClient(api_key=groq_key, model=model, temperature=DEFAULT_TEMPERATURE)


def _build_ollama_cloud() -> LLMProvider:
    ollama_key = os.getenv("OLLAMA_API_KEY", "").strip()
    if not ollama_key:
        raise RuntimeError(
            "LLM_PROVIDER=ollama_cloud but OLLAMA_API_KEY is missing."
        )
    model = os.getenv("LLM_MODEL", "minimax-m2.5:cloud")
    base_url = os.getenv("OLLAMA_BASE_URL", "https://ollama.com")
    # Reasoning models (gpt-oss family) need explicit "low" effort to
    # keep TTFT and content budget reasonable — they emit a "thinking"
    # trace before content and at default effort exhaust num_predict
    # mid-thinking.
    reasoning: Optional[str] = "low" if model.startswith("gpt-oss") else None
    logger.info(
        "[LLM] Using Ollama Cloud %s (reasoning=%s)",
        model,
        reasoning or "n/a",
    )
    return OllamaCloudClient(
        api_key=ollama_key,
        model=model,
        base_url=base_url,
        temperature=DEFAULT_TEMPERATURE,
        reasoning=reasoning,
    )


def _build_provider(name: str) -> LLMProvider:
    """Build a single concrete provider by name. Used by both the
    direct LLM_PROVIDER branches AND the failover wrapper for its
    primary/fallback children.

    Accepts only members of ``_CONCRETE_PROVIDERS`` — the ``failover``
    name is rejected here to prevent infinite recursion / nested
    failover chains.
    """
    if name == "glm":
        return _build_glm()
    if name == "groq":
        return _build_groq()
    if name == "ollama_cloud":
        return _build_ollama_cloud()
    raise RuntimeError(
        f"Unknown concrete LLM provider {name!r}. Expected one of: "
        f"{sorted(_CONCRETE_PROVIDERS)}."
    )


def create_llm() -> LLMProvider:
    """Pick the LLM provider based on env. See module docstring for order."""
    # 1) Explicit switch wins. Fails fast on missing credentials so the
    # operator knows their config is wrong (instead of silently falling
    # back to a different provider).
    provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    if provider:
        if provider in _CONCRETE_PROVIDERS:
            return _build_provider(provider)
        if provider == "failover":
            primary_name = os.getenv("LLM_PRIMARY", "ollama_cloud").strip().lower()
            fallback_name = os.getenv("LLM_FAILOVER", "glm").strip().lower()
            if primary_name == fallback_name:
                raise RuntimeError(
                    f"LLM_PROVIDER=failover requires LLM_PRIMARY != LLM_FAILOVER "
                    f"(both are {primary_name!r})"
                )
            primary = _build_provider(primary_name)
            fallback = _build_provider(fallback_name)
            logger.info(
                "[LLM] Using FailoverLLMClient (primary=%s, fallback=%s)",
                primary_name, fallback_name,
            )
            return FailoverLLMClient(
                primary=primary, fallback=fallback,
                primary_name=primary_name, fallback_name=fallback_name,
            )
        raise RuntimeError(
            f"Unknown LLM_PROVIDER={provider!r}. Expected one of: "
            "glm, groq, ollama_cloud, failover."
        )

    # 2) Legacy credential-presence fallback. Preserves prior behaviour
    # so existing deploys that don't set LLM_PROVIDER keep working
    # (Groq if its key is present, otherwise Ollama Cloud).
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_key:
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        logger.info("[LLM] Using Groq %s (GROQ_API_KEY present)", model)
        return GroqClient(api_key=groq_key, model=model, temperature=DEFAULT_TEMPERATURE)

    ollama_key = os.getenv("OLLAMA_API_KEY", "").strip()
    if ollama_key:
        model = os.getenv("LLM_MODEL", "minimax-m2.5:cloud")
        base_url = os.getenv("OLLAMA_BASE_URL", "https://ollama.com")
        reasoning: Optional[str] = "low" if model.startswith("gpt-oss") else None
        logger.info(
            "[LLM] Using Ollama Cloud %s (reasoning=%s)",
            model,
            reasoning or "n/a",
        )
        return OllamaCloudClient(
            api_key=ollama_key,
            model=model,
            base_url=base_url,
            temperature=DEFAULT_TEMPERATURE,
            reasoning=reasoning,
        )

    raise RuntimeError(
        "No LLM provider configured. Set LLM_PROVIDER (glm|groq|ollama_cloud|failover) "
        "or one of GROQ_API_KEY / OLLAMA_API_KEY."
    )
