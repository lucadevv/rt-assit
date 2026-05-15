import { SectionTitle, SerifEm } from './SectionTitle';

const STEPS = [
  {
    num: '1.',
    title: 'Configurás tu rol',
    body: 'Subís tu CV, definís qué rol estás interpretando hoy (dev senior, account manager, estudiante), y el contexto de la llamada.',
  },
  {
    num: '2.',
    title: 'Te unís a la llamada',
    body: 'Abrís Susurra en una pestaña, compartís la pestaña del Meet, Zoom o Teams. Susurra escucha y transcribe en tiempo real.',
  },
  {
    num: '3.',
    title: 'Te susurra qué decir',
    body: 'Susurra sugiere respuestas en español o inglés, basadas en tu CV y el contexto. Vos las leés, las decís con tus palabras, y brillás.',
  },
] as const;

/**
 * How it works section: 3 numbered steps.
 * Source: design_susurra/index.html lines 816-842.
 */
export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="relative"
      style={{
        padding: '96px 0',
        background: 'rgba(255,255,255,0.4)',
      }}
    >
      <div className="max-w-[1240px] mx-auto px-8">
        <SectionTitle
          eyebrow="Cómo funciona"
          heading={
            <>
              <SerifEm>Tres pasos.</SerifEm> Sin instalar nada.
            </>
          }
          description="Susurra vive en tu navegador. Te unís a tu llamada y compartís una pestaña. Eso es todo."
        />

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
          style={{ marginTop: '56px' }}
        >
          {STEPS.map((step) => (
            <div key={step.num} className="relative">
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '64px',
                  lineHeight: 1,
                  fontWeight: 400,
                  color: 'var(--color-coral)',
                  marginBottom: '16px',
                }}
              >
                {step.num}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '22px',
                  letterSpacing: '-0.02em',
                  marginBottom: '10px',
                  lineHeight: 1.25,
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-dim)',
                  lineHeight: 1.6,
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
