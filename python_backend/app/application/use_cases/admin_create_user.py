"""AdminCreateUser — provision a user with email + hashed password.

Used by ``POST /api/admin/users`` (founder-only, gated by the
``X-Admin-Token`` shared secret in the router). Raises
``ConflictError`` when the email is already taken so the router can
surface a clean 409 ``user_already_exists``.

Auth Sprint A: depends on the ``PasswordHasher`` port (concrete bcrypt
adapter wired in ``presentation/deps.py``)."""
import uuid
from dataclasses import dataclass
from typing import Optional

from app.application.ports.password_hasher import PasswordHasher
from app.application.ports.users_repository import UsersRepository
from app.domain.entities.user import User
from app.domain.exceptions import ConflictError


@dataclass
class AdminCreateUserUseCase:
    users_repo: UsersRepository
    password_hasher: PasswordHasher

    def execute(
        self,
        *,
        email: str,
        password: str,
        is_admin: bool = False,
        name: Optional[str] = None,
    ) -> User:
        existing = self.users_repo.get_by_email(email)
        if existing is not None:
            raise ConflictError("user_already_exists")
        hashed = self.password_hasher.hash(password)
        user_id = f"user_{uuid.uuid4().hex[:24]}"
        return self.users_repo.create_with_password(
            user_id=user_id,
            email=email,
            password_hash=hashed,
            is_admin=is_admin,
            name=name,
        )
