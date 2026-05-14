"""ListInvoicesUseCase + GetInvoiceUseCase."""
from __future__ import annotations

from typing import Optional

from app.application.ports.invoices_repository import InvoicesRepository
from app.domain.entities.invoice import Invoice


class ListInvoicesUseCase:
    def __init__(self, repo: InvoicesRepository) -> None:
        self.repo = repo

    def execute(
        self, *, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[Invoice]:
        return self.repo.list_for_user(user_id, limit=limit, offset=offset)


class GetInvoiceUseCase:
    def __init__(self, repo: InvoicesRepository) -> None:
        self.repo = repo

    def execute(self, *, invoice_id: str, user_id: str) -> Optional[Invoice]:
        return self.repo.get(invoice_id, user_id)
