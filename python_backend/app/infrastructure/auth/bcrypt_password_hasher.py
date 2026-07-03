"""Bcrypt password hasher (concrete adapter for ``PasswordHasher`` port).

Bcrypt via passlib. The ``CryptContext`` is thread-safe so a single
module-level instance is reused across all adapter instances.

Bcrypt is the right primitive here: built-in salting, configurable cost
(default 12 rounds ≈ ~250ms on modern hardware), and a 60-char output
that fits the existing TEXT column. We deliberately do NOT roll our own
algorithm (PBKDF2 / SHA + salt) — passlib handles upgrades transparently
via ``deprecated="auto"``."""
from __future__ import annotations

from passlib.context import CryptContext

from app.application.ports.password_hasher import PasswordHasher


_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class BcryptPasswordHasher(PasswordHasher):
    """Concrete bcrypt-backed hasher used in AUTH_MODE=custom."""

    def hash(self, plain: str) -> str:
        # Bcrypt enforces a 72-byte input limit; passlib pre-hashes
        # nothing for us, so callers should pass passwords of reasonable
        # length (admin endpoint enforces >=12 chars at request schema).
        return _pwd_context.hash(plain)

    def verify(self, plain: str, hashed: str) -> bool:
        # Constant-time bcrypt verify. Returns False on any failure
        # (wrong password, malformed hash, empty inputs) — never raises
        # so the calling use case can return a uniform 401
        # ``invalid_credentials`` and avoid leaking failure modes via
        # different exception types.
        if not plain or not hashed:
            return False
        try:
            return _pwd_context.verify(plain, hashed)
        except Exception:  # noqa: BLE001
            return False
