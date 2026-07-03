"""Port for password hashing + verification (Auth Sprint A).

Kept as a Protocol so the use-cases (login, admin-create) depend on the
contract rather than the concrete bcrypt impl. Lets us swap to argon2id
or migrate cost factors without touching application code."""
from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class PasswordHasher(Protocol):
    """Port for hashing + verifying user passwords.

    ``verify`` MUST run in constant-time relative to the hashed input
    (the underlying bcrypt impl already does this) AND MUST return
    ``False`` rather than raise on any malformed/empty input so the
    calling use-case can return a uniform 401 ``invalid_credentials``
    without leaking failure modes."""

    def hash(self, plain: str) -> str: ...

    def verify(self, plain: str, hashed: str) -> bool: ...
