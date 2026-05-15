import { SectionTitle, SerifEm } from './SectionTitle';

const ROWS = [
  {
    label: 'Idioma',
    other: 'Inglés primero, español traducido',
    susurra: 'es-LATAM con voseo',
  },
  {
    label: 'Plataforma',
    other: 'App desktop (instalar)',
    susurra: 'Web (sin instalar)',
  },
  {
    label: 'Privacy',
    other: 'Cloud, sin garantías',
    susurra: 'OCR en tu browser, cero data breach',
  },
  {
    label: 'Personalización',
    other: 'Asistente genérico',
    susurra: 'Múltiples personas + escenarios',
  },
  {
    label: 'Construido por',
    other: 'Equipo yanqui',
    susurra: 'Dev LATAM, para devs LATAM',
  },
] as const;

/**
 * Comparison table: Otras herramientas vs Susurra (5 rows).
 * Source: design_susurra/index.html lines 844-885.
 */
export function ComparisonSection() {
  return (
    <section id="diferencia" className="relative" style={{ padding: '96px 0' }}>
      <div className="max-w-[1240px] mx-auto px-8">
        <SectionTitle
          eyebrow="Por qué Susurra"
          heading={
            <>
              <SerifEm>No somos</SerifEm> otra herramienta yanqui.
            </>
          }
          description="Las alternativas gringas son potentes pero te tratan como sales lead. Susurra está construido específicamente para devs LATAM."
        />

        <div
          className="mx-auto"
          style={{
            maxWidth: '760px',
            background: 'white',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          {/* Header row */}
          <div
            className="hidden sm:grid"
            style={{
              gridTemplateColumns: '1.3fr 1fr 1fr',
              background: 'var(--color-carbon)',
              color: 'var(--color-ivory)',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            <div style={{ padding: '14px 22px' }} />
            <div
              style={{
                padding: '14px 22px',
                borderLeft: '1px solid var(--line)',
              }}
            >
              Otras herramientas
            </div>
            <div
              style={{
                padding: '14px 22px',
                background: 'var(--color-coral)',
                color: 'var(--color-carbon)',
                borderLeft: '1px solid var(--line)',
              }}
            >
              Susurra
            </div>
          </div>

          {ROWS.map((row, idx) => (
            <div
              key={row.label}
              className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr]"
              style={{
                borderBottom:
                  idx === ROWS.length - 1 ? 'none' : '1px solid var(--line)',
              }}
            >
              <div
                style={{
                  padding: '18px 22px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-carbon)',
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  padding: '18px 22px',
                  fontSize: '14px',
                  color: 'var(--text-mute)',
                  borderLeft: '1px solid var(--line)',
                }}
              >
                <span className="sm:hidden font-semibold">
                  Otras herramientas:{' '}
                </span>
                {row.other}
              </div>
              <div
                className="relative"
                style={{
                  padding: '18px 22px',
                  fontSize: '14px',
                  color: 'var(--color-carbon)',
                  fontWeight: 500,
                  background: 'var(--coral-soft)',
                  borderLeft: '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    color: 'var(--color-coral-deep)',
                    fontWeight: 700,
                    marginRight: '6px',
                  }}
                >
                  ✓
                </span>
                <span className="sm:hidden font-bold">Susurra: </span>
                {row.susurra}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
