"""Generate strong random passwords for beta invitations.

Returns base64url tokens — strong entropy, human-typeable in a pinch but
expected to be copy/pasted from the welcome email. Default 12 bytes ≈ 16
base64url chars ≈ 96 bits of entropy, well above the password policy
floor enforced by ``AdminCreateUserUseCase`` (Pydantic ``min_length=12``).
"""
from __future__ import annotations

import secrets


def generate_password(length_bytes: int = 12) -> str:
    """Return a URL-safe random password.

    ``length_bytes`` is the raw entropy budget; the resulting string is
    ``ceil(length_bytes * 4 / 3)`` characters once base64url-encoded, so
    12 bytes → 16 chars. Strong enough that brute force is infeasible
    even if the email leaks once, and short enough to retype manually."""
    return secrets.token_urlsafe(length_bytes)
