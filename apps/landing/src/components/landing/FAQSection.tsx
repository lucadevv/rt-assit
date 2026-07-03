'use client';

import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  easeOut,
  easeOutQuart,
  fadeUpSubtle,
  staggerContainer,
  viewportOnce,
} from '@/lib/motion-presets';
import { SectionTitle, SerifEm } from './SectionTitle';

type FAQ = {
  q: string;
  a: ReactNode;
};

const ITEMS: FAQ[] = [
  {
    q: '¿Es legal usar Susurra en una entrevista?',
    a: (
      <>
        <p>
          Sí. Susurra es una{' '}
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              color: 'var(--color-carbon)',
              fontSize: '17px',
            }}
          >
            asistencia personal
          </span>
          , como cualquier preparación previa. No te dicta respuestas robóticas:
          te sugiere puntos relevantes basados en tu CV real, y vos elegís qué
          decir con tus palabras.
        </p>
        <p style={{ marginTop: '12px' }}>
          Lo importante es que las respuestas que des sean verdad sobre vos. Si
          decís que tenés experiencia en algo, esa experiencia tiene que ser
          real. Susurra sólo te ayuda a no trabarte al contarla.
        </p>
      </>
    ),
  },
  {
    q: '¿Cuándo abre la beta?',
    a: (
      <>
        <p>
          Estoy onboarding entre 5 y 10 personas por semana. Cada acceso lo doy
          después de una llamada corta con vos.
        </p>
        <p style={{ marginTop: '12px' }}>
          Si dejás tu email en la waitlist, te contacto en orden de llegada.
          Priorizo a quienes me cuentan un caso concreto y específico de cómo lo
          van a usar.
        </p>
      </>
    ),
  },
  {
    q: '¿Cuánto va a costar Susurra?',
    a: (
      <>
        <p>
          Durante la beta privada, el acceso es gratis. No quiero cobrar antes
          de saber que el producto te resuelve un problema real.
        </p>
        <p style={{ marginTop: '12px' }}>
          El pricing final lo voy a definir con feedback de los primeros
          usuarios. Voy a estar abajo del precio de las herramientas gringas, en
          LATAM no tiene sentido cobrar $96/mes.
        </p>
      </>
    ),
  },
  {
    q: '¿Mi data está segura?',
    a: (
      <>
        <p>
          La privacy es la base del producto. La transcripción y el OCR corren
          en tu navegador cuando es posible. Lo que sí va a servidores está
          cifrado y nunca se comparte ni se vende.
        </p>
        <p style={{ marginTop: '12px' }}>
          Si trabajás en una empresa con compliance estricto, podés pedirme la
          opción self-hosted.
        </p>
      </>
    ),
  },
  {
    q: '¿Funciona con voseo argentino, modismos peruanos, etc.?',
    a: (
      <p>
        Sí. Susurra está construido específicamente para español LATAM. Entiende
        voseo, &ldquo;che&rdquo;, &ldquo;parce&rdquo;, &ldquo;wey&rdquo;,
        &ldquo;mande&rdquo;, &ldquo;chévere&rdquo;, todo.{' '}
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            color: 'var(--color-carbon)',
            fontSize: '17px',
          }}
        >
          Y respeta cómo hablás vos.
        </span>
      </p>
    ),
  },
];

/**
 * FAQ section: collapsible items with controlled state for smooth accordion reveal.
 * Source: design_susurra/index.html lines 963-1007.
 */
export function FAQSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: 'visible' as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: viewportOnce,
      };

  return (
    <section id="faq" className="relative" style={{ padding: '96px 0' }}>
      <div className="max-w-[1240px] mx-auto px-8">
        <motion.div variants={staggerContainer(0, 0.05)} {...reveal}>
          <motion.div variants={fadeUpSubtle} transition={{ duration: 0.6, ease: easeOutQuart }}>
            <SectionTitle
              heading={
                <>
                  Preguntas <SerifEm>honestas.</SerifEm>
                </>
              }
            />
          </motion.div>

          <motion.div
            className="mx-auto flex flex-col gap-1"
            style={{ maxWidth: '720px' }}
            variants={staggerContainer(0.05, 0.05)}
          >
            {ITEMS.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: FAQ) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const buttonId = useId();

  return (
    <motion.div
      className="faq-item"
      style={{
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
      variants={fadeUpSubtle}
      transition={{ duration: 0.5, ease: easeOutQuart }}
    >
      <button
        type="button"
        id={buttonId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left cursor-pointer transition-colors duration-150 hover:bg-[rgba(245,239,230,0.5)]"
        style={{
          padding: '22px 26px',
          fontWeight: 500,
          fontSize: '17px',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
        }}
      >
        <span>{q}</span>
        <span
          className={`transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${
            isOpen ? 'rotate-45' : ''
          }`}
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '28px',
            color: 'var(--color-coral)',
            lineHeight: 1,
            display: 'inline-block',
          }}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 26px 24px',
                fontSize: '15px',
                color: 'var(--text-dim)',
                lineHeight: 1.65,
              }}
            >
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
