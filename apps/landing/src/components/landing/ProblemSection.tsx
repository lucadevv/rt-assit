'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  easeOutQuart,
  fadeUpSubtle,
  staggerContainer,
  viewportOnce,
} from '@/lib/motion-presets';
import { SectionTitle, SerifEm } from './SectionTitle';

const CARDS = [
  {
    icon: '01',
    title: 'Entrevista de trabajo',
    body: 'Te preguntan "tell me about a challenging project" y tu mente queda en blanco. Sabés la respuesta pero las palabras en inglés se traban bajo presión.',
  },
  {
    icon: '02',
    title: 'Llamada con cliente',
    body: 'Reunión técnica con cliente gringo o europeo. Te falta la palabra exacta para explicar tu arquitectura. Querés sonar senior, terminás sonando dubitativo.',
  },
  {
    icon: '03',
    title: 'Defensa de proyecto',
    body: 'Demo del sprint, defensa de tesis, presentación al equipo. Olvidás un punto clave por los nervios. Susurra te lo susurra antes de que lo pierdas.',
  },
] as const;

/**
 * Problem section: eyebrow + headline + 3-card grid.
 * Source: design_susurra/index.html lines 788-814.
 */
export function ProblemSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: 'visible' as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: viewportOnce,
      };

  const cardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <section id="problema" className="relative" style={{ padding: '96px 0' }}>
      <div className="max-w-[1240px] mx-auto px-8">
        <motion.div variants={staggerContainer(0, 0.08)} {...reveal}>
          <motion.div variants={fadeUpSubtle} transition={{ duration: 0.6, ease: easeOutQuart }}>
            <SectionTitle
              eyebrow="El problema"
              heading={
                <>
                  Sabés la respuesta. <SerifEm>Pero te trabás.</SerifEm>
                </>
              }
              description="Tres situaciones reales donde el dev LATAM más preparado pierde oportunidades por no encontrar las palabras en el momento exacto."
            />
          </motion.div>

          <motion.div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
            variants={staggerContainer(0.1, 0.1)}
          >
            {CARDS.map((card) => (
              <motion.article
                key={card.title}
                className="transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-[3px] active:scale-[0.98]"
                style={{
                  background: 'white',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  padding: '28px 26px',
                }}
                variants={cardVariant}
                transition={{ duration: 0.6, ease: easeOutQuart }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 44,
                    height: 44,
                    background: 'var(--coral-soft)',
                    borderRadius: '12px',
                    marginBottom: '18px',
                    fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--color-coral-text)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {card.icon}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    fontSize: '19px',
                    letterSpacing: '-0.015em',
                    marginBottom: '10px',
                    lineHeight: 1.3,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-dim)',
                    lineHeight: 1.6,
                  }}
                >
                  {card.body}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
