'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  easeOutQuart,
  fadeUpSubtle,
  staggerContainer,
  viewportOnce,
} from '@/lib/motion-presets';
import { SectionTitle, SerifEm } from './SectionTitle';

const ROWS = [
  {
    label: 'Idioma',
    other: 'Inglés. Español a veces, traducido',
    susurra: 'es-LATAM con voseo nativo',
  },
  {
    label: 'Instalación',
    other: 'App desktop (Electron). Permisos de OS, instalar, actualizar.',
    susurra: 'Web. Abrís pestaña, listo.',
  },
  {
    label: 'Foco',
    other: 'Notetaker genérico o copilot de sales',
    susurra: 'Especialista en interviews técnicas dev',
  },
  {
    label: 'Persona + CV',
    other: 'AI genérico, sin contexto tuyo',
    susurra: 'Sugiere EN PRIMERA PERSONA según tu CV y rol',
  },
  {
    label: 'Vendor lock-in',
    other: 'Atado a una sola plataforma de transcripción',
    susurra: 'Multi-provider con failover (Ollama, Groq, GLM)',
  },
  {
    label: 'Construido por',
    other: 'Equipos en San Francisco o startups gringas',
    susurra: 'Dev LATAM, para devs LATAM',
  },
] as const;

/**
 * Comparison table: Otras herramientas vs Susurra (6 rows).
 * Differentiation vs Otter / Fireflies / Fathom / call.md (video-db).
 * Source: design_susurra/index.html lines 844-885.
 */
export function ComparisonSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: 'visible' as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: viewportOnce,
      };

  const rowVariant = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <section id="diferencia" className="relative" style={{ padding: '96px 0' }}>
      <div className="max-w-[1240px] mx-auto px-8">
        <motion.div variants={staggerContainer(0, 0.08)} {...reveal}>
          <motion.div variants={fadeUpSubtle} transition={{ duration: 0.6, ease: easeOutQuart }}>
            <SectionTitle
              eyebrow="Por qué Susurra"
              align="left"
              heading={
                <>
                  <SerifEm>No somos</SerifEm> otra herramienta yanqui.
                </>
              }
            />
          </motion.div>

          <motion.div
            className="mx-auto"
            style={{
              maxWidth: '760px',
              background: 'white',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
            variants={staggerContainer(0.1, 0.06)}
          >
            {/* Header row */}
            <motion.div
              className="hidden sm:grid"
              style={{
                gridTemplateColumns: '1.4fr 0.9fr 1.5fr',
                background: 'var(--color-carbon)',
                color: 'var(--color-ivory)',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
              variants={rowVariant}
              transition={{ duration: 0.5, ease: easeOutQuart }}
            >
              <div style={{ padding: '14px 22px' }} />
              <div
                style={{
                  padding: '14px 22px',
                  borderLeft: '1px solid var(--line)',
                  fontSize: '12px',
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
                  fontSize: '14px',
                }}
              >
                Susurra
              </div>
            </motion.div>

            {ROWS.map((row, idx) => (
              <motion.div
                key={row.label}
                className="grid grid-cols-1 sm:grid-cols-[1.4fr_0.9fr_1.5fr]"
                style={{
                  borderBottom:
                    idx === ROWS.length - 1 ? 'none' : '1px solid var(--line)',
                }}
                variants={rowVariant}
                transition={{ duration: 0.5, ease: easeOutQuart }}
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
                      color: 'var(--color-coral-text)',
                      fontWeight: 700,
                      marginRight: '6px',
                    }}
                  >
                    ✓
                  </span>
                  <span className="sm:hidden font-bold">Susurra: </span>
                  {row.susurra}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            variants={rowVariant}
            transition={{ duration: 0.5, ease: easeOutQuart }}
            style={{
              fontSize: 12,
              color: 'var(--text-mute)',
              fontFamily: 'var(--font-sans)',
              textAlign: 'center',
              lineHeight: 1.6,
              maxWidth: 580,
              margin: '24px auto 0',
            }}
          >
            Comparación referencia a productos como Otter, Fireflies, Fathom y call.md (video-db).
            No competimos con ellos en su mercado — ellos no compiten con nosotros en el nuestro.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
