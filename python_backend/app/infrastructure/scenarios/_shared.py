"""Shared per-turn user template used by all built-in scenarios.

The same conversational frame applies regardless of scenario: a window of
the most recent counterpart utterances + the responses we generated. Only
the system prompt (persona) differentiates scenarios.

Token contract (filled by ``PromptBuilder``):
    {n_questions}        -> number of past counterpart utterances shown
    {past_questions}     -> formatted list of past utterances
    {n_hints}            -> number of past responses shown
    {past_hints}         -> formatted list of past generated responses
    {current_transcript} -> the new utterance we have to respond to
"""

DEFAULT_USER_TEMPLATE = """\
INTERVENCIONES PREVIAS DEL OTRO LADO (últimas {n_questions}):
{past_questions}

RESPUESTAS PREVIAS QUE GENERASTE (últimas {n_hints}):
{past_hints}

NUEVA INTERVENCIÓN: "{current_transcript}"

Tu respuesta (en primera persona):"""
