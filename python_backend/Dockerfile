# syntax=docker/dockerfile:1.7
# python_backend — FastAPI + LangGraph + Chroma served by uv.

FROM python:3.12-slim AS base

# uv for fast dependency resolution / install.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# System deps (chromadb / pydantic-core compile fallbacks; ca-certificates
# for outbound TLS to Ollama Cloud / OpenAI).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

WORKDIR /app

# Resolve dependencies first for better layer caching.
# The 'dev' optional-dependencies group (pytest, pytest-asyncio, ruff,
# mypy) is intentionally included so CI and ad-hoc
# `docker exec rtassist-backend pytest ...` work without the
# `uv run --with pytest --with pytest-asyncio` prefix dance. The size
# overhead is small relative to the chromadb/torch transitive set already
# pulled in for prod.
COPY pyproject.toml ./
RUN uv sync --extra dev

# App source + dev/maintenance scripts (E2E text test, etc.) + tests.
# Scripts are optional at runtime but baking them in avoids the
# `docker cp scripts ...` step every time we rebuild for iteration.
# Tests ride along so CI can run `docker exec rtassist-backend pytest`
# directly without volume mounts.
COPY app ./app
COPY scripts ./scripts
COPY tests ./tests

# Persistence directory for Chroma (matches VectorStore default ./data/chroma).
RUN mkdir -p /app/data \
    && groupadd --system rtassist \
    && useradd --system --gid rtassist --home /app rtassist \
    && chown -R rtassist:rtassist /app

USER rtassist

EXPOSE 8767

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8767"]
