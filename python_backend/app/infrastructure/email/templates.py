"""Hardcoded Spanish-first email templates (B5 — Billing).

Each template is a dict with ``subject``, ``html``, ``text`` keys. The
``render(name, context)`` function does a safe ``str.format``-based
substitution. Missing keys default to empty string so a partial context
doesn't crash the send.

Templates intentionally live in infrastructure/ because they are presentation
strings, not business rules. The matching `Send*EmailUseCase` in
application/use_cases/send_emails.py owns the orchestration."""
from __future__ import annotations

from collections import defaultdict
from typing import Any


WELCOME = {
    "subject": "Bienvenido a Susurra",
    "html": (
        "<h1>Hola {name}!</h1>"
        "<p>Acabás de empezar tu trial gratis de 14 días en Pro. ¡Disfrutalo!</p>"
        "<p>— El equipo de Susurra</p>"
    ),
    "text": (
        "Hola {name}!\n\n"
        "Acabás de empezar tu trial gratis de 14 días en Pro. ¡Disfrutalo!\n\n"
        "— El equipo de Susurra"
    ),
}

TRIAL_EXPIRING = {
    "subject": "Tu trial de Susurra Pro expira pronto",
    "html": (
        "<h1>Hola {name}</h1>"
        "<p>Tu trial gratis termina en {hours_left} horas. Si querés mantener "
        "acceso a las features Pro, podés suscribirte cuando quieras.</p>"
        "<p>— El equipo de Susurra</p>"
    ),
    "text": (
        "Hola {name}\n\n"
        "Tu trial gratis termina en {hours_left} horas. Si querés mantener "
        "acceso a las features Pro, podés suscribirte cuando quieras.\n\n"
        "— El equipo de Susurra"
    ),
}

INVOICE_PAID = {
    "subject": "Recibo de pago — Susurra",
    "html": (
        "<h1>Pago confirmado</h1>"
        "<p>Recibimos tu pago de <strong>{amount} {currency}</strong>. "
        "Gracias por confiar en Susurra.</p>"
        "<p><a href='{invoice_url}'>Ver factura</a></p>"
        "<p>— El equipo de Susurra</p>"
    ),
    "text": (
        "Pago confirmado\n\n"
        "Recibimos tu pago de {amount} {currency}. Gracias por confiar en Susurra.\n"
        "Factura: {invoice_url}\n\n"
        "— El equipo de Susurra"
    ),
}

PAYMENT_FAILED = {
    "subject": "Problema con tu pago — Susurra",
    "html": (
        "<h1>No pudimos procesar tu pago</h1>"
        "<p>Hubo un problema con tu pago. Tenés 7 días para regularizarlo "
        "antes de que la suscripción se desactive.</p>"
        "<p><a href='{retry_url}'>Reintentar pago</a></p>"
        "<p>— El equipo de Susurra</p>"
    ),
    "text": (
        "No pudimos procesar tu pago\n\n"
        "Hubo un problema con tu pago. Tenés 7 días para regularizarlo "
        "antes de que la suscripción se desactive.\n"
        "Reintentar: {retry_url}\n\n"
        "— El equipo de Susurra"
    ),
}

DUNNING = {
    "subject": "Recordatorio de pago — Susurra",
    "html": (
        "<h1>Recordatorio de pago (intento {attempt})</h1>"
        "<p>Te enviamos este recordatorio porque tu pago aún no fue procesado. "
        "Para mantener tu plan Pro activo, regularizalo lo antes posible.</p>"
        "<p><a href='{retry_url}'>Regularizar ahora</a></p>"
        "<p>— El equipo de Susurra</p>"
    ),
    "text": (
        "Recordatorio de pago (intento {attempt})\n\n"
        "Te enviamos este recordatorio porque tu pago aún no fue procesado. "
        "Para mantener tu plan Pro activo, regularizalo lo antes posible.\n"
        "Regularizar: {retry_url}\n\n"
        "— El equipo de Susurra"
    ),
}

USAGE_WARNING = {
    "subject": "Estás cerca del límite de tu plan",
    "html": (
        "<h1>Hola {name}</h1>"
        "<p>Llegaste al {percent}% de tu límite de <strong>{limit_name}</strong> "
        "para este mes. Si necesitás más, podés pasar a Pro cuando quieras.</p>"
        "<p>— El equipo de Susurra</p>"
    ),
    "text": (
        "Hola {name}\n\n"
        "Llegaste al {percent}% de tu límite de {limit_name} para este mes. "
        "Si necesitás más, podés pasar a Pro cuando quieras.\n\n"
        "— El equipo de Susurra"
    ),
}


_TEMPLATES: dict[str, dict[str, str]] = {
    "welcome": WELCOME,
    "trial_expiring": TRIAL_EXPIRING,
    "invoice_paid": INVOICE_PAID,
    "payment_failed": PAYMENT_FAILED,
    "dunning": DUNNING,
    "usage_warning": USAGE_WARNING,
}


def render(name: str, context: dict[str, Any]) -> tuple[str, str, str]:
    """Render a template into (subject, html, text). Missing context keys
    default to empty string so the call never raises KeyError."""
    template = _TEMPLATES.get(name)
    if template is None:
        raise ValueError(f"unknown email template: {name}")

    safe_ctx: dict[str, Any] = defaultdict(str, context)
    subject = _format_safe(template["subject"], safe_ctx)
    html = _format_safe(template["html"], safe_ctx)
    text = _format_safe(template["text"], safe_ctx)
    return subject, html, text


def _format_safe(template: str, context: dict[str, Any]) -> str:
    """str.format that swallows KeyError by returning the literal placeholder."""
    try:
        return template.format_map(context)
    except (KeyError, IndexError):
        return template
