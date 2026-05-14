"""Pre-filter for non-question transcripts to skip LLM calls.

Pure heuristic — no I/O, no framework. Belongs to application layer because
it expresses domain policy ("what counts as a meaningful question?")."""
import re


# Filler/transition words/phrases that almost never carry a question.
FILLER_EXACT: set[str] = {
    "ok", "okey", "okay", "vale", "claro", "perfecto", "buenísimo", "buenisimo",
    "bueno", "ajá", "aja", "mhm", "uhum", "entonces", "gracias", "muchas gracias",
    "exacto", "tal cual", "sí", "si", "no", "ya", "dale", "listo",
    "hola", "buenas", "buen día", "buenas tardes", "buenas noches",
    "qué tal", "cómo estás", "cómo va",
}

# Lower bound on word count for a meaningful question.
# Set to 1 so single-word imperatives like "Preséntate", "Cuéntame", "Explícame"
# pass through to the LLM. Filler is still caught by FILLER_EXACT above.
MIN_WORDS_FOR_QUESTION = 1


class QuestionFilter:
    """Cheap heuristic filter to skip clearly non-question utterances."""

    FILLER_EXACT = FILLER_EXACT
    MIN_WORDS_FOR_QUESTION = MIN_WORDS_FOR_QUESTION

    def is_likely_filler(self, transcript: str) -> bool:
        """Return True for clearly non-question utterances."""
        if not transcript or not transcript.strip():
            return True
        cleaned = re.sub(r"[¿?¡!,.;:]", "", transcript).strip().lower()
        if cleaned in self.FILLER_EXACT:
            return True
        word_count = len(cleaned.split())
        if word_count < self.MIN_WORDS_FOR_QUESTION:
            return True
        return False
