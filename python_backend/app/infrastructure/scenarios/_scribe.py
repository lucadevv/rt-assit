"""Scribe mode — orthogonal to scenario. Susurra observes and takes
structured notes instead of speaking in the user's voice.

The template adapts naturally per-scenario via the ``{scenario_label}``
and ``{scenario_focus}`` placeholders — legal scenarios → cite normativa,
business → decisiones, interview → preguntas. Same template, scenario
context drives the framing.

Token contract (filled by ``PromptBuilder.build`` when ``mode='scribe'``):
    {candidate_name}             -> the user's display name (observer ref)
    {scenario_label}             -> scenario.label (Spanish, e.g. "Consulta legal con cliente")
    {scenario_focus}             -> per-scenario "focus" bullet line
    {identity_docs}               -> formatted CV / profile / linkedin / bio
    {scenario_docs}               -> scenario-specific docs
    {reference_docs}              -> any extra "reference" docs
    {screen_text_block}           -> G2 OCR screen context (or empty)
    {session_materials_block}     -> H2 per-session brief/agenda/link (or empty)
    {persona_custom_instructions} -> H2 persona overlay (or empty)
"""

SCRIBE_SYSTEM_TEMPLATE = """\
Sos un ASISTENTE que toma notas estructuradas en tiempo real durante una reunión de {scenario_label}.

⚠️ NUNCA hablás en primera persona como participante. Vos OBSERVÁS lo que se está diciendo y producís NOTAS.

Tu output va a la pantalla del usuario ({candidate_name}) para que las revise mientras escucha.

CONTEXTO DE LA REUNIÓN:

{identity_docs}

MATERIAL DE REFERENCIA:

{scenario_docs}

{reference_docs}

{screen_text_block}

{session_materials_block}

FORMATO DE CADA TURNO:
Devolvé las notas en este formato Markdown estructurado. NO uses prosa larga.

📝 **Tema**: una frase corta
🎯 **Hechos / acuerdos**: lo concreto que se dijo o acordó (bullets)
{scenario_focus}
📅 **Action items**: tareas + responsable + fecha estimada (si corresponde)
❓ **Pendientes**: qué quedó abierto

REGLAS:
- Solo escribí lo que realmente se mencionó. NO inventes acuerdos.
- Si la intervención fue trivial (saludo, filler), omití la nota — devolvé sólo `(sin contenido relevante)`.
- Si hay normativa, fechas, montos, nombres propios mencionados, CAPTURALOS textualmente.
- Tono: telegráfico, profesional, sin opinión personal.
- Idioma: español neutro (sin voseo en las notas).
- No incluyas la pregunta/intervención que provocó la nota — solo el resumen.

{persona_custom_instructions}
"""


# Per-scenario "focus" line that customizes what to capture beyond the
# basic structure. Keys MUST match the scenario ids defined in
# ``app.infrastructure.scenarios.*`` — kept in sync manually because the
# scenario list is small (11 entries) and the focus copy is hand-tuned
# per domain.
SCRIBE_FOCUS_BY_SCENARIO: dict[str, str] = {
    "legal_client_call":  "⚖️ **Aspectos legales mencionados**: artículos, leyes, plazos, riesgos",
    "legal_negotiation":  "⚖️ **Cláusulas / posiciones**: qué propone cada parte, qué se modifica",
    "legal_hearing":      "⚖️ **Argumentos y citas**: jurisprudencia, artículos, doctrina invocada",
    "meeting_business":   "💼 **Decisiones del proyecto**: qué se aprobó, métricas mencionadas",
    "client_call":        "📞 **Issues del cliente**: problemas reportados, prioridades",
    "sales_call":         "💰 **Objeciones / interés**: nivel de fit, próximos pasos comerciales",
    "interview_dev":      "💻 **Preguntas técnicas hechas**: tema + nivel de profundidad",
    "interview_behavioral": "🧠 **Situaciones STAR pedidas**: contexto + competencia evaluada",
    "exam_oral":          "🎓 **Temas evaluados**: unidad del programa + nivel de respuesta",
    "thesis_defense":     "🎓 **Capítulos / tesis cuestionados**: argumento + defensa",
    "personal":           "💬 **Tópicos / preferencias**: lo que importa o se mencionó",
}

# Generic fallback when a custom scenario id has no specific focus line.
DEFAULT_FOCUS = "📌 **Detalles clave**: cualquier dato relevante"


SCRIBE_USER_TEMPLATE = """\
INTERVENCIONES PREVIAS DEL OTRO LADO (últimas {n_questions}):
{past_questions}

NOTAS PREVIAS QUE GENERASTE (últimas {n_hints}):
{past_hints}

NUEVA INTERVENCIÓN: "{current_transcript}"

Notas:"""
"""Per-turn user prompt for scribe mode.

Mirrors ``_shared.DEFAULT_USER_TEMPLATE`` in structure (same placeholders,
same windows) but renames the closing line from "Tu respuesta (en primera
persona):" to "Notas:" so the LLM keeps the 3rd-person framing consistent
with the system prompt."""
