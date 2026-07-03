# Product

## Register

brand

## Users

Devs LATAM (es-LATAM) preparándose para entrevistas técnicas en inglés. Power users tech-savvy, early adopters de herramientas como Linear, Raycast, Cursor. Conocen la diferencia entre Otter y un buen producto. Viven en español pero el ascensor profesional pasa por entrevistas en inglés con companies remote-first. La ansiedad de blank-out en interviews es real, repetitiva, y se vive todos los días.

El público se expande después a otros profesionales LATAM que viven en reuniones críticas en inglés (sales, founders, consultores), pero el wedge es interviews técnicas.

## Product Purpose

Susurra es el copilot íntimo de reuniones. Escucha la llamada, entiende el contexto (CV, rol, scenario), y sugiere la respuesta exacta en el español del usuario, lista para hablar. No graba, no transcribe para revisión post-mortem, no resume meetings. Sugiere en tiempo real, en silencio, mientras hablás.

Éxito: el usuario sale de la entrevista sintiendo "fui yo, pero la mejor versión". Conversión primaria de la landing = entender que **el producto se llama SUSURRA** (no Auri, que es un nombre deprecated). Conversión secundaria = anotarse en waitlist por invitación.

## Brand Personality

**Silencioso, atento, preciso.**

- Silencioso: no grita, no hace claim de magic AI, no usa sparkles. El nombre mismo es un susurro.
- Atento: escucha primero, sugiere después. La tecnología sirve al usuario, no al revés.
- Preciso: una sugerencia bien puesta vale más que cinco genéricas. Calidad sobre volumen.

Voz: cercana pero refinada. Tutea (vos, en es-LATAM). No es jerga tech bro ni corporate. Tono de un confidente que sabe lo que hace.

Emoción objetivo en los primeros 5 segundos del landing: **identificación urgente** — "esto me pasa todos los días, este producto entiende mi problema específico".

## Anti-references

- **AI genérico tipo Otter / Fireflies / Fathom**: dashboards azules, AI badges en hero, robots ilustrados, "powered by GPT-4" prominente, gradientes neon morado-celeste, sparkles ✨ decorativos. Susurra debe verse DISTINTO del category leader de notetakers, no como una variación cream-coral del mismo template.
- **Editorial-magazine cliché (Klim-influenced)**: display serif italic como sistema completo + columnas rule-separated + drop caps + uppercase tracked labels en cada section + broadsheet grid + cream sin propósito. Susurra usa **serif italic como ACENTO** (el wordmark, una palabra clave del headline), no como sistema editorial. La diferencia importa.
- **Enterprise / corporate tipo Microsoft Teams / Zoom**: logos de Fortune 500, stock photos de gente de traje en oficinas con monitores curvos, casos de uso "Empresas que confían en nosotros", footer con "Para CTOs / Para RRHH / Para Compliance". Susurra es para personas individuales, no para procurement.
- **AI marketing 2024-2026 saturado**: gradientes morados-celestes, blob 3D, magic wand icons, "10x your productivity", before/after sliders mostrando "sin AI vs con AI".

## Design Principles

1. **El producto se demuestra, no se explica.** El hero muestra el producto en uso (mockup con conversación en vivo + sugerencia + CV context). Cero claims abstractos tipo "AI for meetings". Mostrá el momento exacto donde Susurra ayuda.

2. **Hablá en es-LATAM, sin disculpas.** "Te susurra qué decir. Vos brillás." es voseo cercano. La landing usa "vos", "pedí", "ponete las pilas". El inglés aparece SOLO donde es product (ejemplos de interview en inglés). No traducir a neutro español plano.

3. **Restraint es voz, no ausencia.** El brand puede permitirse Committed color strategy (coral + carbon + ivory carrying 60% de la superficie). Restraint significa NO meter sparkles, NO meter gradientes morados, NO meter stock AI illustrations — pero el coral debe ser DRENADO donde aparece.

4. **Cada elemento prueba "esto entiende mi problema".** Identificación urgente requiere especificidad: nombrar "entrevista técnica", "Google Meet", "tu CV", "Flutter mobile", "migración legacy". Cero ejemplos abstractos. La specificity es lo que distingue de Otter genérico.

5. **Silencio entre secciones.** Generosa spacing vertical, una idea por fold, scroll deliberado. No comprimir el deck en una sola pantalla maximalista. La marca es susurrada — el ritmo de la landing también.

## Accessibility & Inclusion

- **WCAG AA target** (contrast ≥4.5:1 for body text, ≥3:1 for large/UI). Initially aimed for AAA but the warm coral palette made it geometrically impossible without sacrificing brand voice. Added `--color-coral-text` (#8C3220, contrast ~7.6:1 on ivory) for AAA-grade text-use of coral specifically; `coral-deep` (#E55A3F, contrast 3.15:1) remains for non-text roles (hover states, large display, UI elements like the comparison header bg). Body text on carbon-ivory hits 14.3:1 (AAA).
- **Motion-sensitive focus**: `prefers-reduced-motion` ya implementado a nivel global en `globals.css`. Cualquier nueva animación debe respetar este media query. Evitar parallax intenso, evitar autoplay videos, evitar transformaciones grandes (>50px translate) en motion habilitado.
- **Keyboard navigation completa**: todos los CTAs, links del nav, summary de FAQ, footer links navegables con Tab. Focus visible (ring coral). Ya implícito en `<a>` semánticos + native `<details>`.
- **Idioma declarado**: `<html lang="es-AR">` o `es-LA` en `layout.tsx`. Verificar.
- **Alt text en imagery**: si se agregan fotos reales (founder, testimonial, screenshots), alt text descriptivo en es-LATAM, no genérico.

## Open Questions / Tensions

1. **Nombre del assistant vs producto**: El producto es Susurra. Pero internamente el "agent" históricamente se llamó Auri. Pendiente: confirmar si Auri sigue siendo el nombre del personality/agent INTERNO o si también se renombra. Afecta copy de la web app, no la landing.
