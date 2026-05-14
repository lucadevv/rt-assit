"""E2E text-only test harness for the transcript -> LLM pipeline.

Run inside the backend container:

    docker exec -w /app -e PYTHONPATH=/app rtassist-backend \
        /app/.venv/bin/python scripts/e2e_text_test.py

Bypasses Deepgram + WebSocket. For each test case we:
  1. Resolve the scenario behavior and check `should_respond(transcript, [])`.
  2. If approved, build (system, user) prompts via `PromptBuilder.build(...)`.
  3. Stream the response from the configured `LLMProvider`.
  4. Record metrics (latency, fallback detection, CV-citation hits).

Outputs a tabular report + summary at the end.
"""
from __future__ import annotations

import asyncio
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

# These imports trigger the application wiring. They only work inside the
# rtassist-backend container (FastAPI is not installed on the host).
from app.domain.entities.chat_message import ChatMessage
from app.presentation.deps import (
    get_behavior_registry,
    get_documents_repository,
    get_llm_provider,
    get_prompt_builder,
    get_scenarios_repository,
    get_users_repository,
)


USER_ID = "dev_default"
DEFAULT_SCENARIO_FOR_PROMPT = "interview_dev"

# Fallback signature used by the live agent when it can't make sense of the
# transcript. Anything starting with this prefix is considered a fallback.
FALLBACK_PREFIX = "Disculpame, no te entendí"

# CV citation tokens are derived DYNAMICALLY at runtime from the user's
# identity docs (CV / profile / linkedin / bio). This keeps the test
# multi-tenant: a user named "Maria" with a Java/Spring CV gets tokens
# {"maria", "java", "spring", ...} — not the previous hardcoded Flutter/
# Lima/Carranza set that only worked for one specific dev user.
# Populated at script entry by ``_derive_cv_tokens()``.
CV_CITATION_TERMS: list[str] = []

# Max chars of the response we keep in the report cell.
RESPONSE_SNIPPET_LEN = 200

# Tightened PASS criterion: any visible response below this length is treated
# as a failure. The original suite considered `resp_len=0` as passing because
# it only flagged the literal "Disculpame, no te entendí" fallback prefix —
# real empty-stream failures slipped through. 20 chars is a generous floor.
MIN_USEFUL_RESPONSE_CHARS = 20


@dataclass
class TestCase:
    transcript: str
    expected_should_respond: bool
    # If True, response should mention at least one CV term (CV-grounded
    # questions). If None, we don't enforce CV-citation.
    expect_cv_citation: Optional[bool] = None


@dataclass
class TestResult:
    scenario: str
    transcript: str
    expected_should_respond: bool
    actual_should_respond: bool
    response_text: str
    latency_seconds: float
    is_fallback: bool
    cites_cv: Optional[bool]
    expect_cv_citation: Optional[bool]
    error: Optional[str] = None
    # Sub-task 2 instrumentation
    system_prompt_chars: int = 0
    user_prompt_chars: int = 0
    thinking_tokens: int = 0
    content_tokens: int = 0
    estimated_total_tokens: int = 0

    @property
    def fail_reason(self) -> str:
        """Returns the first reason this case fails, or empty string if it passes."""
        if self.error:
            return f"error={self.error}"
        if self.actual_should_respond != self.expected_should_respond:
            return (
                f"filter_mismatch(expected={self.expected_should_respond},"
                f"actual={self.actual_should_respond})"
            )
        if not self.actual_should_respond:
            # Expected skip, got skip — fine.
            return ""
        # We expected a response AND got one.
        if self.is_fallback:
            return "fallback_response"
        if len(self.response_text) < MIN_USEFUL_RESPONSE_CHARS:
            return (
                f"too_short(len={len(self.response_text)},"
                f"min={MIN_USEFUL_RESPONSE_CHARS})"
            )
        if self.expect_cv_citation is True and self.cites_cv is False:
            return "cv_citation_missing"
        return ""

    @property
    def passed(self) -> bool:
        return self.fail_reason == ""


SCENARIOS_TEST_CASES: dict[str, list[TestCase]] = {
    "interview_dev": [
        TestCase("¿Cuál es tu nombre?", expected_should_respond=True),
        TestCase("Contame de vos", expected_should_respond=True, expect_cv_citation=True),
        TestCase(
            "¿Qué experiencia tenés con Flutter?",
            expected_should_respond=True,
            expect_cv_citation=True,
        ),
        TestCase("Explicame el patrón Builder", expected_should_respond=True),
        TestCase("ahora", expected_should_respond=False),
    ],
    "interview_behavioral": [
        TestCase(
            "Contame una situación en la que tuviste un conflicto con un compañero",
            expected_should_respond=True,
        ),
        TestCase("¿Cómo manejás el estrés?", expected_should_respond=True),
        TestCase("hola", expected_should_respond=False),
    ],
    "meeting_business": [
        TestCase("¿Cuál es el status del proyecto?", expected_should_respond=True),
        TestCase("¿Tenés alguna decisión pendiente?", expected_should_respond=True),
        TestCase("hola", expected_should_respond=False),
    ],
    "client_call": [
        # Courtesy openers ARE expected to get a reply on client calls.
        TestCase("Hola, ¿cómo estás?", expected_should_respond=True),
        TestCase("Tengo un problema con el producto", expected_should_respond=True),
    ],
    "sales_call": [
        TestCase("Hola, ¿cuál es tu propuesta?", expected_should_respond=True),
        TestCase("ok", expected_should_respond=True),  # tiny filler still answered
        TestCase("mhm", expected_should_respond=False),
    ],
    "exam_oral": [
        TestCase("Definí inteligencia artificial", expected_should_respond=True),
        TestCase("¿Qué es backpropagation?", expected_should_respond=True),
        TestCase("hola", expected_should_respond=False),
    ],
    "thesis_defense": [
        TestCase(
            "¿Cómo justifica el tamaño de su muestra?", expected_should_respond=True
        ),
        TestCase(
            "¿Cuáles son las limitaciones de su metodología?",
            expected_should_respond=True,
        ),
        TestCase("ahora", expected_should_respond=False),
    ],
    "personal": [
        TestCase("Hola", expected_should_respond=True),
        TestCase("¿Qué hago hoy?", expected_should_respond=True),
        TestCase("ahora", expected_should_respond=True),
    ],
}


def _truncate(text: str, limit: int = RESPONSE_SNIPPET_LEN) -> str:
    text = text.replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def _cites_cv(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in CV_CITATION_TERMS)


def _derive_cv_tokens(*, users_repo, docs_repo, user_id: str) -> list[str]:
    """Build the CV-citation token set dynamically from the user's identity
    docs. Returns a list of lowercase substrings — if a response includes
    ANY of them, we consider it CV-grounded.

    Strategy:
      1. First-name from ``user.name`` (the most reliable identity token
         resolvable by the prompt_builder).
      2. Capitalised proper nouns from the first ~3000 chars of identity
         doc content (typically Summary + first job title) — captures
         stacks, cities, employer names without hardcoding.
      3. Tokens are lower-cased and de-duplicated; we drop generic stop
         words and tokens shorter than 4 chars to reduce false positives.

    The set is intentionally permissive: any 1 match passes ``_cites_cv``.
    A false-negative (CV-grounded answer that uses words NOT in the user's
    CV) is acceptable; a false-positive (un-grounded answer that happens
    to mention a generic Spanish word) is what we filter against."""
    import re

    tokens: set[str] = set()

    user = users_repo.get_by_id(user_id)
    if user and user.name:
        first_name = user.name.strip().split()[0]
        if len(first_name) >= 3:
            tokens.add(first_name.lower())

    identity_doc_types = {"cv", "profile", "linkedin", "bio"}
    docs = docs_repo.list(user_id=user_id, scenario=None, include_global=True)
    identity_docs = [d for d in docs if d.doc_type in identity_doc_types]

    # Spanish/English stop words we DON'T want to count as CV evidence.
    _STOP_WORDS = {
        "para", "como", "este", "esta", "estos", "estas", "tiene", "tener",
        "todo", "toda", "todos", "todas", "donde", "cuando", "cuanto",
        "cuanta", "cuantos", "muchas", "muchos", "varias", "varios",
        "desde", "hasta", "entre", "sobre", "ademas", "tambien", "mismo",
        "misma", "siempre", "nunca", "ahora", "luego", "antes", "después",
        "puede", "pueden", "tipo", "tipos", "soft", "junior", "senior",
        "lead", "manager", "team", "with", "from", "their", "which",
        "that", "this", "have", "been", "will", "your", "more", "than",
    }

    proper_noun_re = re.compile(r"\b([A-ZÁÉÍÓÚÑ][a-záéíóúñü+#./-]{3,})\b")
    for d in identity_docs:
        head = (d.content or "")[:3000]
        for match in proper_noun_re.finditer(head):
            tok = match.group(1).lower()
            if tok in _STOP_WORDS:
                continue
            tokens.add(tok)

    # Cap at a reasonable size so the membership check stays fast and
    # readable in logs.
    return sorted(tokens)[:40]


def _is_fallback(text: str) -> bool:
    return text.strip().startswith(FALLBACK_PREFIX)


def _estimate_tokens(text: str) -> int:
    """Cheap token estimate (~ 4 chars per token). Avoids pulling tiktoken."""
    return max(1, len(text) // 4)


async def _run_case(
    *,
    scenario_id: str,
    case: TestCase,
    behavior_registry,
    prompt_builder,
    scenarios_repo,
    docs_repo,
    llm,
) -> TestResult:
    behavior = behavior_registry.get(scenario_id)
    actual_should_respond = behavior.should_respond(case.transcript, [])

    response_text = ""
    latency = 0.0
    is_fallback = False
    cites_cv: Optional[bool] = None
    error: Optional[str] = None
    system_chars = 0
    user_chars = 0
    thinking_tokens = 0
    content_tokens = 0

    if actual_should_respond:
        try:
            system, user = prompt_builder.build(
                scenario_id=scenario_id,
                user_id=USER_ID,
                current_transcript=case.transcript,
                past_questions=[],
                past_hints=[],
                scenarios_repo=scenarios_repo,
                docs_repo=docs_repo,
            )
            system_chars = len(system)
            user_chars = len(user)
            messages = [ChatMessage(role="user", content=user)]
            chunks: list[str] = []
            # We tap into `_stream_once` when available so we can count
            # thinking vs content tokens. This mirrors the SAME reasoning the
            # configured client would use on the FIRST attempt — the salvage
            # retry that `stream()` performs is NOT executed here on purpose,
            # so the metrics reflect the raw behavior we want to fix.
            t0 = time.monotonic()
            # Fase D — measure with the per-scenario reasoning the prod
            # path will use. ``behavior.reasoning_effort()`` overrides the
            # client's constructor-time default ("low" for gpt-oss). When
            # it returns None we explicitly disable reasoning for this
            # call, matching what ``_generate_node`` does at runtime.
            scenario_reasoning = behavior.reasoning_effort()
            scenario_max_tokens = behavior.max_response_tokens()
            # Fase D — when the behavior explicitly returns None for
            # reasoning, the prod path tells the client to send
            # ``think: false`` (Ollama-native disable). Mirror that here
            # so the measurement matches what real users get.
            scenario_disable_thinking = scenario_reasoning is None
            if hasattr(llm, "_stream_once"):
                async for kind, value in llm._stream_once(
                    messages=messages,
                    system=system,
                    max_tokens=scenario_max_tokens,
                    reasoning=scenario_reasoning,
                    disable_thinking=scenario_disable_thinking,
                ):
                    if kind == "content":
                        chunks.append(value)
                        content_tokens += _estimate_tokens(value)
                    elif kind == "thinking":
                        thinking_tokens += _estimate_tokens(value)
                # If raw pass produced no content but we saw thinking, run
                # the salvage retry the public `stream()` would have done so
                # the test still reflects what real users get. The salvage
                # retries with reasoning="low" + padded budget — gpt-oss
                # ignores think:false in practice, so we MUST run salvage
                # even when the primary attempt had disable_thinking=True.
                if not chunks and thinking_tokens > 0:
                    async for kind, value in llm._stream_once(
                        messages=messages,
                        system=system,
                        max_tokens=scenario_max_tokens,
                        reasoning="low",
                        disable_thinking=False,
                    ):
                        if kind == "content":
                            chunks.append(value)
                            content_tokens += _estimate_tokens(value)
            else:
                async for token in llm.stream(
                    messages=messages,
                    system=system,
                    max_tokens=scenario_max_tokens,
                ):
                    chunks.append(token)
                    content_tokens += _estimate_tokens(token)
            latency = time.monotonic() - t0
            response_text = "".join(chunks)
            is_fallback = _is_fallback(response_text)
            cites_cv = _cites_cv(response_text)
        except Exception as exc:  # noqa: BLE001
            error = f"{type(exc).__name__}: {exc}"

    estimated_total = (
        _estimate_tokens(case.transcript)
        + (_estimate_tokens("") if not actual_should_respond else (system_chars + user_chars) // 4)
        + content_tokens
        + thinking_tokens
    )

    return TestResult(
        scenario=scenario_id,
        transcript=case.transcript,
        expected_should_respond=case.expected_should_respond,
        actual_should_respond=actual_should_respond,
        response_text=response_text,
        latency_seconds=latency,
        is_fallback=is_fallback,
        cites_cv=cites_cv,
        expect_cv_citation=case.expect_cv_citation,
        error=error,
        system_prompt_chars=system_chars,
        user_prompt_chars=user_chars,
        thinking_tokens=thinking_tokens,
        content_tokens=content_tokens,
        estimated_total_tokens=estimated_total,
    )


def _print_table(results: list[TestResult]) -> None:
    headers = (
        "scenario",
        "transcript",
        "filter",
        "resp_len",
        "latency",
        "fallback",
        "cites_cv",
        "verdict",
    )
    widths = (22, 50, 6, 8, 7, 8, 8, 6)

    def _fmt_row(cells: tuple[str, ...]) -> str:
        return " | ".join(c[:w].ljust(w) for c, w in zip(cells, widths))

    bar = "=" * (sum(widths) + 3 * (len(widths) - 1))
    print(bar)
    print(f" E2E TEXT TEST — {len(SCENARIOS_TEST_CASES)} scenarios × N prompts")
    print(bar)
    print(" " + _fmt_row(headers))
    print(" " + "-+-".join("-" * w for w in widths))

    for r in results:
        # Filter cell: PASS means filter approved the transcript; SKIP means it didn't.
        # "MISS" means filter disagreed with our expectation.
        if r.actual_should_respond == r.expected_should_respond:
            filter_cell = "PASS" if r.actual_should_respond else "SKIP"
        else:
            filter_cell = "MISS"

        if r.error:
            resp_len = "ERR"
            latency = "-"
            fallback = "-"
            cites = "-"
        elif r.actual_should_respond:
            resp_len = str(len(r.response_text))
            latency = f"{r.latency_seconds:.2f}s"
            fallback = "yes" if r.is_fallback else "no"
            if r.cites_cv is None:
                cites = "-"
            else:
                cites = "yes" if r.cites_cv else "no"
        else:
            resp_len = "-"
            latency = "-"
            fallback = "-"
            cites = "-"

        verdict = "OK" if r.passed else "FAIL"

        cells = (
            r.scenario,
            f'"{r.transcript}"',
            filter_cell,
            resp_len,
            latency,
            fallback,
            cites,
            verdict,
        )
        print(" " + _fmt_row(cells))


def _print_scenario_instrumentation(results: list[TestResult]) -> None:
    """Per-scenario breakdown of prompt size, latency, thinking budget, empties.

    Empty-stream count = cases where we expected a response and got resp_len=0.
    This is the metric we are trying to drive toward zero.
    """
    by_scenario: dict[str, list[TestResult]] = {}
    for r in results:
        by_scenario.setdefault(r.scenario, []).append(r)

    headers = (
        "scenario",
        "avg_sys",
        "avg_usr",
        "avg_lat",
        "avg_think_tk",
        "avg_resp_tk",
        "empty",
        "fallback",
    )
    widths = (22, 8, 7, 8, 12, 11, 6, 8)

    def _fmt_row(cells: tuple[str, ...]) -> str:
        return " | ".join(c[:w].ljust(w) for c, w in zip(cells, widths))

    bar = "=" * (sum(widths) + 3 * (len(widths) - 1))
    print()
    print(bar)
    print(" PER-SCENARIO INSTRUMENTATION (Sub-task 2)")
    print(bar)
    print(" " + _fmt_row(headers))
    print(" " + "-+-".join("-" * w for w in widths))

    for scenario_id, items in by_scenario.items():
        responded = [r for r in items if r.actual_should_respond and not r.error]
        if responded:
            avg_sys = sum(r.system_prompt_chars for r in responded) / len(responded)
            avg_usr = sum(r.user_prompt_chars for r in responded) / len(responded)
            avg_lat = sum(r.latency_seconds for r in responded) / len(responded)
            avg_think = sum(r.thinking_tokens for r in responded) / len(responded)
            avg_resp = sum(r.content_tokens for r in responded) / len(responded)
        else:
            avg_sys = avg_usr = avg_lat = avg_think = avg_resp = 0.0
        empty = sum(
            1
            for r in items
            if r.actual_should_respond
            and not r.error
            and len(r.response_text) < MIN_USEFUL_RESPONSE_CHARS
        )
        fallback = sum(1 for r in items if r.is_fallback)
        cells = (
            scenario_id,
            f"{avg_sys:.0f}",
            f"{avg_usr:.0f}",
            f"{avg_lat:.2f}s",
            f"{avg_think:.0f}",
            f"{avg_resp:.0f}",
            str(empty),
            str(fallback),
        )
        print(" " + _fmt_row(cells))


def _print_summary(results: list[TestResult]) -> None:
    bar = "=" * 72
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    responded = [r for r in results if r.actual_should_respond and not r.error]
    avg_latency = (
        sum(r.latency_seconds for r in responded) / len(responded)
        if responded
        else 0.0
    )
    fallbacks = [r for r in results if r.is_fallback]
    errors = [r for r in results if r.error]

    fallbacks_per_scenario: dict[str, int] = {}
    for r in fallbacks:
        fallbacks_per_scenario[r.scenario] = fallbacks_per_scenario.get(r.scenario, 0) + 1

    print()
    print(bar)
    print(" SUMMARY")
    print(bar)
    print(f" Total cases: {total}")
    print(f" Passed: {passed}")
    print(f" Failed: {failed}")
    print(f" Avg latency: {avg_latency:.2f}s (over {len(responded)} responses)")
    print(f" Fallback count: {len(fallbacks)}")
    if fallbacks_per_scenario:
        for scenario, n in sorted(fallbacks_per_scenario.items()):
            print(f"   - {scenario}: {n}")
    print(f" Errors: {len(errors)}")
    if errors:
        for r in errors:
            print(f"   - [{r.scenario}] {r.transcript!r}: {r.error}")

    failed_results = [r for r in results if not r.passed]
    if failed_results:
        print()
        print(" Failed cases:")
        for r in failed_results:
            print(
                f"   - [{r.scenario}] {r.transcript!r} -> "
                f"{r.fail_reason or 'unknown'} | "
                f"sys={r.system_prompt_chars}ch usr={r.user_prompt_chars}ch "
                f"lat={r.latency_seconds:.2f}s "
                f"think_tk={r.thinking_tokens} resp_tk={r.content_tokens}"
            )


async def _main() -> int:
    behavior_registry = get_behavior_registry()
    prompt_builder = get_prompt_builder()
    scenarios_repo = get_scenarios_repository()
    docs_repo = get_documents_repository()
    users_repo = get_users_repository()
    llm = get_llm_provider()

    # Multi-tenant CV-citation tokens — derived from THIS user's identity
    # docs so the test works for any user, not just dev_default with the
    # Flutter/Lima/Carranza profile.
    global CV_CITATION_TERMS
    CV_CITATION_TERMS = _derive_cv_tokens(
        users_repo=users_repo, docs_repo=docs_repo, user_id=USER_ID,
    )
    print(
        f"[E2E] CV-citation tokens for user={USER_ID!r}: "
        f"{len(CV_CITATION_TERMS)} terms — sample: "
        f"{CV_CITATION_TERMS[:8]}"
    )

    results: list[TestResult] = []
    suite_t0 = time.monotonic()
    for scenario_id, cases in SCENARIOS_TEST_CASES.items():
        for case in cases:
            result = await _run_case(
                scenario_id=scenario_id,
                case=case,
                behavior_registry=behavior_registry,
                prompt_builder=prompt_builder,
                scenarios_repo=scenarios_repo,
                docs_repo=docs_repo,
                llm=llm,
            )
            results.append(result)
            tag = "OK  " if result.passed else "FAIL"
            extra = ""
            if result.actual_should_respond and not result.error:
                extra = f" ({result.latency_seconds:.2f}s, len={len(result.response_text)})"
            elif not result.actual_should_respond:
                extra = " (skipped)"
            elif result.error:
                extra = f" (ERROR: {result.error})"
            print(f"  [{tag}] {scenario_id:22} | {case.transcript[:50]!r}{extra}")

    suite_elapsed = time.monotonic() - suite_t0

    print()
    _print_table(results)
    _print_scenario_instrumentation(results)
    _print_summary(results)

    print()
    print(f" Total suite time: {suite_elapsed:.2f}s")

    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
