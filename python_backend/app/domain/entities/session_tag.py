"""SessionTag domain entity (B1).

Free-form tag attached to a session — favorite, work, personal, custom."""
from dataclasses import dataclass


@dataclass
class SessionTag:
    session_id: str
    tag: str
