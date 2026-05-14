"""Extract a candidate's display name from an identity document (CV / profile / LinkedIn / bio).

Pure-application use case — depends only on the ``Document`` domain entity
and Python stdlib (``re``). NO infrastructure imports.

Heuristic (intentionally conservative — better to return ``None`` than a
wrong name):

1. Only run for doc_types in ``IDENTITY_DOC_TYPES`` (cv / profile / linkedin / bio).
2. Inspect the first ``MAX_LINES_TO_SCAN`` non-empty lines.
3. A line is considered a "name" line when:
   - It has 2 to 4 tokens.
   - Each token starts with an uppercase letter (accents allowed: Á É Í Ó Ú Ñ Ü).
   - Tokens contain only letters / accents / hyphens / apostrophes.
   - The line is short (<= ``MAX_NAME_LENGTH`` chars).
   - It does NOT look like a heading we want to skip ("CURRICULUM VITAE",
     "RESUMÉ", "PROFILE", an email, a phone number, a URL, etc.).
4. Skip lines that are ALL UPPERCASE — these are usually section headers,
   not names. (Most CVs print the actual name in title-case.)
5. Return the first matching line, trimmed.

Wired into the three upload use cases (``upload_document``,
``upload_document_from_text``, ``upload_document_from_url``) so a freshly
uploaded CV / profile / LinkedIn / bio can backfill ``user.name`` when the
user hasn't set a real name yet.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from app.application.ports.users_repository import UsersRepository
from app.domain.entities.document import IDENTITY_DOC_TYPES, Document


MAX_LINES_TO_SCAN = 12
MAX_NAME_LENGTH = 60
MIN_TOKENS = 2
MAX_TOKENS = 4

# Lines that should be skipped entirely.
_SKIP_KEYWORDS: set[str] = {
    "curriculum",
    "vitae",
    "curriculum vitae",
    "resume",
    "resumé",
    "résumé",
    "cv",
    "profile",
    "perfil",
    "biography",
    "bio",
    "about",
    "sobre mi",
    "sobre mí",
    "linkedin",
    "summary",
    "resumen",
    "objetivo",
    "experience",
    "experiencia",
    "education",
    "educación",
    "skills",
    "habilidades",
    "contact",
    "contacto",
}

# A "name token": 2+ letters, starts uppercase, allows accents / hyphen / apostrophe.
# Examples that match: "Juan", "García", "O'Connor", "Jean-Luc", "Núñez".
_NAME_TOKEN_RE = re.compile(
    r"^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'’\-]+(?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'’\-]+)?$"
)
_EMAIL_RE = re.compile(r"\S+@\S+\.\S+")
_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
_HAS_DIGIT_RE = re.compile(r"\d")


def _is_skipworthy(stripped: str) -> bool:
    """Return True if the line is obviously NOT a person's name."""
    if not stripped:
        return True
    if len(stripped) > MAX_NAME_LENGTH:
        return True
    if _EMAIL_RE.search(stripped):
        return True
    if _URL_RE.search(stripped):
        return True
    if _HAS_DIGIT_RE.search(stripped):
        return True
    # All-uppercase (likely a header); we want title-cased actual names.
    if stripped == stripped.upper() and any(ch.isalpha() for ch in stripped):
        return True
    lowered = stripped.lower().rstrip(":.,")
    if lowered in _SKIP_KEYWORDS:
        return True
    return False


def _looks_like_name(stripped: str) -> bool:
    tokens = stripped.split()
    if not (MIN_TOKENS <= len(tokens) <= MAX_TOKENS):
        return False
    return all(_NAME_TOKEN_RE.match(tok) for tok in tokens)


def extract_name_from_text(text: str) -> Optional[str]:
    """Pure helper — exported for testability.

    Scans the first lines of ``text`` for a person's name. Returns the
    name verbatim (whitespace-trimmed) or ``None`` when no confident
    match is found."""
    if not text:
        return None

    lines_seen = 0
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        lines_seen += 1
        if lines_seen > MAX_LINES_TO_SCAN:
            break
        if _is_skipworthy(stripped):
            continue
        if _looks_like_name(stripped):
            return stripped
    return None


class ExtractIdentityNameUseCase:
    """Inspects an identity document and returns the person's name (or None).

    Stateless / pure — no repos, no infrastructure. Safe to instantiate
    on demand or share a singleton."""

    def execute(self, document: Document) -> Optional[str]:
        if document.doc_type not in IDENTITY_DOC_TYPES:
            return None
        return extract_name_from_text(document.content)


# Names we treat as "no real name set yet" — safe to overwrite. Lower-cased
# for case-insensitive comparison.
DEFAULT_USER_NAMES: set[str] = {"", "dev user", "default"}


_logger = logging.getLogger(__name__)


def maybe_backfill_user_name(
    *,
    users_repo: Optional[UsersRepository],
    extractor: ExtractIdentityNameUseCase,
    user_id: str,
    document: Document,
) -> None:
    """Run the identity-name extractor and update ``user.name`` when the
    user has no real name set yet. Failures are non-fatal: a successful
    document upload is NEVER blocked by the name backfill.

    The decision tree:
      1. ``users_repo`` is None  -> skip silently (caller didn't wire it).
      2. ``document`` is not an identity doc -> extractor returns None -> skip.
      3. Extractor returns None  -> no confident name found -> skip.
      4. User already has a real name (not in ``DEFAULT_USER_NAMES``) -> skip.
      5. Otherwise, update ``user.name`` and log it.

    This is exported as a free function so all three upload use cases
    (file / text / url) share the SAME backfill logic."""
    if users_repo is None:
        return
    try:
        candidate_name = extractor.execute(document)
    except Exception as exc:  # noqa: BLE001
        _logger.warning("[ExtractIdentityName] extraction failed: %s", exc)
        return
    if not candidate_name:
        return
    try:
        user = users_repo.get_by_id(user_id)
    except Exception as exc:  # noqa: BLE001
        _logger.warning(
            "[ExtractIdentityName] users_repo.get_by_id failed: %s", exc
        )
        return
    if user is None:
        return
    current = (user.name or "").strip().lower()
    if current and current not in DEFAULT_USER_NAMES:
        # User already has a real name — never override.
        return
    try:
        users_repo.update_name(user_id=user_id, name=candidate_name)
        _logger.info(
            "[ExtractIdentityName] user_id=%s name backfilled to %r from doc=%s",
            user_id,
            candidate_name,
            document.id,
        )
    except Exception as exc:  # noqa: BLE001
        _logger.warning(
            "[ExtractIdentityName] users_repo.update_name failed: %s", exc
        )
