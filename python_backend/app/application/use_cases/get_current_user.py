"""GetCurrentUser — fetch user by id, raises NotFoundError if missing."""
from app.application.ports.users_repository import UsersRepository
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundError


class GetCurrentUserUseCase:
    """Fetch the user entity by id."""

    def __init__(self, users_repo: UsersRepository) -> None:
        self.users_repo = users_repo

    def execute(self, *, user_id: str) -> User:
        user = self.users_repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError(f"Usuario no encontrado: {user_id}")
        return user
