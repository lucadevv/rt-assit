"""DeleteUserData — GDPR/LGPD compliant account delete.

For B0 we do a hard delete of the user row + cascade-deleted preferences.
Documents owned by the user are also deleted. Future B5 will retain invoices
for legal 7-year window via a separate audit-preserving flow."""
from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.application.ports.users_repository import UsersRepository


class DeleteUserDataUseCase:
    """GDPR delete — removes user, prefs, and owned documents."""

    def __init__(
        self,
        users_repo: UsersRepository,
        preferences_repo: UserPreferencesRepository,
        documents_repo: DocumentsRepository,
    ) -> None:
        self.users_repo = users_repo
        self.preferences_repo = preferences_repo
        self.documents_repo = documents_repo

    def execute(self, *, user_id: str) -> bool:
        # Cascade order: documents -> prefs -> user.
        # Prefs FK has ON DELETE CASCADE so users_repo.delete also cleans it,
        # but we call explicitly to support repos that don't enforce FKs.
        for doc in self.documents_repo.list(user_id=user_id):
            self.documents_repo.delete(doc_id=doc.id, user_id=user_id)
        self.preferences_repo.delete(user_id=user_id)
        return self.users_repo.delete(user_id)
