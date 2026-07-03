'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  easeOutQuart,
  fadeUpSubtle,
  staggerContainer,
  viewportOnce,
} from '@/lib/motion-presets';
import { SectionTitle, SerifEm } from './SectionTitle';

const STEPS = [
  {
    num: '01',
    title: 'Configurás tu rol',
    body: 'Subís tu CV, definís qué rol estás interpretando hoy (dev senior, account manager, estudiante), y el contexto de la llamada.',
  },
  {
    num: '02',
    title: 'Te unís a la llamada',
    body: 'Abrís Susurra en una pestaña, compartís la pestaña del Meet, Zoom o Teams. Susurra escucha y transcribe en tiempo real.',
  },
  {
    num: '03',
    title: 'Te susurra qué decir',
    body: 'Susurra sugiere respuestas en español o inglés, basadas en tu CV y el contexto. Vos las leés, las decís con tus palabras, y brillás.',
  },
] as const;

/**
 * How it works section: 3 numbered steps.
 * Source: design_susurra/index.html lines 816-842.
 */
export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: 'visible' as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: viewportOnce,
      };

  const stepVariant = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

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
        <motion.div variants={staggerContainer(0, 0.08)} {...reveal}>
          <motion.div variants={fadeUpSubtle} transition={{ duration: 0.6, ease: easeOutQuart }}>
            <SectionTitle
              heading={
                <>
                  <SerifEm>Tres pasos.</SerifEm> Sin instalar nada.
                </>
              }
              description="Susurra vive en tu navegador. Te unís a tu llamada y compartís una pestaña. Eso es todo."
            />
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
            style={{ marginTop: '56px' }}
            variants={staggerContainer(0.1, 0.12)}
          >
            {STEPS.map((step) => (
              <motion.div
                key={step.num}
                className="relative text-left"
                variants={stepVariant}
                transition={{ duration: 0.7, ease: easeOutQuart }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 800,
                    fontSize: 'clamp(72px, 10vw, 96px)',
                    lineHeight: 0.9,
                    letterSpacing: '-0.05em',
                    color: 'var(--color-carbon)',
                    marginBottom: '20px',
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
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
