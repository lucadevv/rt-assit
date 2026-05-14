"""Document domain entities.

Pure data — no framework or infrastructure dependencies."""
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

DocType = Literal[
    "cv",
    "profile",
    "linkedin",
    "bio",
    "job_offer",
    "company_research",
    "meeting_brief",
    "account_history",
    "case_study",
    "playbook",
    "exam_syllabus",
    "evaluation_criteria",
    "persona",
    "reference",
    "other",
]

VALID_DOC_TYPES: set[str] = {
    # identity / profile
    "cv",
    "profile",
    "linkedin",
    "bio",
    # interview / job
    "job_offer",
    "company_research",
    # meetings / accounts
    "meeting_brief",
    "account_history",
    # sales
    "case_study",
    "playbook",
    # academia
    "exam_syllabus",
    "evaluation_criteria",
    # personal
    "persona",
    # generic
    "reference",
    "other",
}

# Doc types that describe the speaker's identity (used by the identity-name
# extractor and PromptBuilder's identity-vs-scenario-vs-reference split).
IDENTITY_DOC_TYPES: set[str] = {"cv", "profile", "linkedin", "bio"}


@dataclass
class Document:
    """A persisted document with id and metadata."""

    id: int
    user_id: str
    doc_type: str
    scenario: Optional[str]
    title: str
    content: str
    source: Optional[str]
    metadata: dict[str, Any] = field(default_factory=dict)
    uploaded_at: Optional[str] = None
    # Wave 2A — "Principal" toggle (UI star). At most one primary per
    # (user_id, scenario_id) within the IDENTITY_DOC_TYPES group. Defaults
    # to False so all existing rows + new inserts are non-primary unless
    # explicitly marked via PATCH /api/documents/{id}.
    is_primary: bool = False


@dataclass
class ExtractedDoc:
    """Result of running an extractor on raw bytes/url. Pre-Document, no id yet."""

    title: str
    content: str
    source: str
    detected_format: str
