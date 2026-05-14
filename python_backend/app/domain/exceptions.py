"""Domain-level exceptions. Presentation layer translates these to HTTP codes."""


class DomainError(Exception):
    """Base class for all domain errors."""


class NotFoundError(DomainError):
    """Resource not found (404)."""


class ValidationError(DomainError):
    """Invalid input (400)."""


class ExtractionError(DomainError):
    """Extraction from a source (file/url) failed (422)."""


class UnauthorizedError(DomainError):
    """Auth credentials missing or invalid (401)."""


class UpgradeRequiredError(DomainError):
    """The action requires a higher plan tier (402 Payment Required).

    Carries the limit that was hit + the minimum tier required so the
    presentation layer can surface a contextual upgrade CTA."""

    def __init__(
        self,
        message: str,
        *,
        limit: str | None = None,
        current_tier: str | None = None,
        required_tier: str | None = None,
    ) -> None:
        super().__init__(message)
        self.limit = limit
        self.current_tier = current_tier
        self.required_tier = required_tier


class ConflictError(DomainError):
    """Resource conflict (409). Used by promo redemption and idempotent flows."""


class GoneError(DomainError):
    """Resource existed but is no longer available (410 Gone).

    Used for share links that are revoked or expired — the resource
    legitimately existed but is intentionally unavailable now."""


class RateLimitExceededError(DomainError):
    """Too many requests (429). Raised by the rate-limit middleware
    or any use case enforcing a per-user / per-IP quota."""


class ServiceUnavailableError(DomainError):
    """External dependency degraded or circuit breaker open (503).

    Used when an LLM/STT/email provider is failing repeatedly so the
    presentation layer can return a 503 with a friendly retry hint
    instead of a generic 500."""
