"""Strongly-typed id newtypes used across layers."""
from typing import NewType

UserId = NewType("UserId", str)
DocumentId = NewType("DocumentId", int)
SessionId = NewType("SessionId", str)
