'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  easeOut,
  easeOutExpo,
  fadeIn,
  fadeUp,
  scaleIn,
  staggerContainer,
} from '@/lib/motion-presets';

/**
 * Hero section: pill badge + headline + lead + dual CTAs + product mockup
 * with floating annotation chips.
 * Source: design_susurra/index.html lines 712-786.
 */
export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const initial = shouldReduceMotion ? false : 'hidden';
  const animate = 'visible';

  return (
    <section
      className="relative text-center"
      style={{ padding: '136px 0 100px' /* 56 + 80 to clear fixed nav */ }}
    >
      {/* Ambient coral glow */}
      <motion.div
        aria-hidden="true"
        className="absolute pointer-events-none z-0"
        style={{
          top: '-120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '1100px',
          height: '700px',
          background:
            'radial-gradient(ellipse at center top, rgba(255,123,92,0.10) 0%, rgba(255,123,92,0.03) 30%, transparent 65%)',
        }}
        variants={fadeIn}
        initial={initial}
        animate={animate}
        transition={{ duration: 1.2, ease: easeOut }}
      />

      <motion.div
        className="relative z-[1] max-w-[1240px] mx-auto px-8"
        variants={staggerContainer(0, 0.1)}
        initial={initial}
        animate={animate}
      >
        {/* Pill badge */}
        <motion.div
          className="inline-flex items-center gap-2 mb-8 rounded-full"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-coral-text)',
            padding: '7px 16px',
            border: '1px solid rgba(26, 26, 36, 0.12)',
            background: 'rgba(255, 255, 255, 0.5)',
          }}
          variants={fadeUp}
          transition={{ duration: 0.5, ease: easeOut, delay: 0 }}
        >
          <span
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: 'var(--color-coral)',
            }}
          />
          <span>Beta cerrada por invitación · es-LATAM</span>
        </motion.div>

        {/* Headline */}
        <h1
          className="mx-auto"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: 'clamp(40px, 8vw, 84px)',
            lineHeight: 1.0,
            letterSpacing: '-0.045em',
            maxWidth: '920px',
            margin: '0 auto 22px',
            color: 'var(--color-carbon)',
          }}
        >
          <motion.span
            className="block"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.1 }}
          >
            Te susurra qué decir.
          </motion.span>
          <motion.span
            style={{
              display: 'block',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--color-coral)',
              fontSize: 'clamp(48px, 9.5vw, 100px)',
              letterSpacing: '-0.025em',
            }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.25 }}
          >
            Vos brillás.
          </motion.span>
        </h1>

        {/* Lead */}
        <motion.p
          className="mx-auto"
          style={{
            fontSize: 'clamp(16px, 2vw, 19px)',
            color: 'var(--text-dim)',
            maxWidth: '580px',
            margin: '0 auto 38px',
            lineHeight: 1.55,
          }}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut, delay: 0.4 }}
        >
          El copilot íntimo para devs LATAM. Susurra escucha tu llamada y te
          sugiere la respuesta exacta, en tu español, basada en tu CV y tu rol.
        </motion.p>

        {/* CTA row */}
        <motion.div
          className="inline-flex gap-3 flex-wrap justify-center mb-16"
          variants={staggerContainer(0.5, 0.06)}
          initial={initial}
          animate={animate}
        >
          <motion.a
            href="#waitlist"
            className="rounded-full font-semibold transition-transform duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-[2px] active:scale-[0.97]"
            style={{
              background: 'var(--color-coral)',
              color: 'var(--color-carbon)',
              padding: '14px 26px',
              fontSize: '15px',
              boxShadow: '0 6px 20px -6px rgba(255,123,92,0.5)',
            }}
            variants={fadeUp}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            Pedir invitación →
          </motion.a>
          <motion.a
            href="#como-funciona"
            className="rounded-full font-medium transition-colors duration-200 hover:bg-white active:scale-[0.97]"
            style={{
              background: 'rgba(255,255,255,0.6)',
              color: 'var(--color-carbon)',
              padding: '14px 22px',
              fontSize: '15px',
              border: '1px solid var(--line)',
            }}
            variants={fadeUp}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            Ver cómo funciona
          </motion.a>
        </motion.div>

        {/* Product mockup */}
        <motion.div
          variants={scaleIn}
          initial={initial}
          animate={animate}
          transition={{ duration: 0.9, ease: easeOutExpo, delay: 0.6 }}
        >
          <ProductMockup shouldReduceMotion={!!shouldReduceMotion} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function ProductMockup({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean;
}) {
  const chipInitial = shouldReduceMotion ? false : 'hidden';
  return (
    <div
      className="relative mx-auto"
      style={{ maxWidth: '1080px' }}
    >
      {/* Floating chips (hidden under 880px via class below) */}
      <FloatChip
        className="hidden min-[880px]:flex anim-float-a"
        style={{ top: 60, left: -12 }}
        label="Escucha en vivo"
        initial={chipInitial}
      />
      <FloatChip
        className="hidden min-[880px]:flex anim-float-b"
        style={{ top: 60, right: -12 }}
        label="100% privado"
        initial={chipInitial}
      />
      <FloatChip
        className="hidden min-[880px]:flex anim-float-a-rev"
        style={{ top: 220, left: -30 }}
        label="40+ idiomas"
        initial={chipInitial}
      />

      {/* Browser-like card */}
      <div
        style={{
          background: 'white',
          borderRadius: '18px',
          boxShadow:
            '0 30px 80px -20px rgba(26,26,36,0.22), 0 8px 24px -4px rgba(26,26,36,0.08)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }}
      >
        {/* Product bar */}
        <div
          className="flex items-center gap-2.5"
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--line)',
            background: 'rgba(245,239,230,0.5)',
          }}
        >
          <div className="flex gap-1.5">
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: 'rgba(26,26,36,0.12)',
              }}
            />
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: 'rgba(26,26,36,0.12)',
              }}
            />
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: 'rgba(26,26,36,0.12)',
              }}
            />
          </div>
          <div
            className="flex-1 text-center"
            style={{
              fontFamily: '"SF Mono", Menlo, monospace',
              fontSize: '11px',
              color: 'var(--text-mute)',
            }}
          >
            meet.google.com/dev-interview
          </div>
          <div
            className="flex items-center gap-1.5"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-mute)',
            }}
          >
            Compartir pestaña
          </div>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr]"
          style={{ minHeight: '380px' }}
        >
          {/* Left — live conversation */}
          <div
            className="flex flex-col"
            style={{
              padding: '28px',
              background: 'var(--color-ivory)',
              borderRight: '1px solid var(--line)',
            }}
          >
            <div className="flex items-center gap-3 mb-[22px]">
              <div
                className="flex items-center justify-center"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--color-coral)',
                  color: 'white',
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '22px',
                  lineHeight: 1,
                  paddingBottom: '3px',
                }}
              >
                s
              </div>
              <div>
                <div
                  style={{ fontSize: '14px', fontWeight: 500 }}
                  className="flex items-center"
                >
                  Entrevista técnica
                  <span
                    className="ml-2 inline-flex items-center gap-1"
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--color-coral-text)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <span
                      className="anim-pulse-coral"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--color-coral)',
                      }}
                    />
                    LIVE
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-mute)',
                    marginTop: '2px',
                  }}
                >
                  Compartiendo Google Meet · 12 min
                </div>
              </div>
            </div>

            <ConvoMsg
              speakerLabel="Entrevistador"
              speakerInitial="E"
              text={
                <>
                  &ldquo;Tell me about a{' '}
                  <em
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontStyle: 'italic',
                      color: 'var(--color-coral-text)',
                      fontSize: '15px',
                    }}
                  >
                    challenging project
                  </em>{' '}
                  you worked on. What was your role and what did you learn?&rdquo;
                </>
              }
            />
            <ConvoMsg
              speakerLabel="Vos"
              speakerInitial="V"
              text='"Sure, I led the migration of our payment system..."'
            />
          </div>

          {/* Right — suggestion + context */}
          <div
            className="flex flex-col gap-[18px]"
            style={{
              padding: '28px 24px',
              background: 'white',
            }}
          >
            <div>
              <RightLabel>Susurra te sugiere</RightLabel>
              <div
                style={{
                  background: 'rgba(245,239,230,0.5)',
                  border: '1px solid rgba(255,123,92,0.2)',
                  borderLeft: '3px solid var(--color-coral)',
                  padding: '13px 15px',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: '14px',
                    lineHeight: 1.45,
                    color: 'var(--color-carbon)',
                  }}
                >
                  &ldquo;I led the migration of our payment system from monolith
                  to microservices. The biggest challenge was...&rdquo;
                </div>
              </div>
            </div>

            <div>
              <RightLabel>Contexto de tu CV</RightLabel>
              <div
                style={{
                  background: 'rgba(245,239,230,0.6)',
                  padding: '14px',
                  borderRadius: '10px',
                }}
              >
                <ContextItem>4 años en Flutter mobile</ContextItem>
                <ContextItem>Migración de arquitectura legacy</ContextItem>
                <ContextItem>Ing. de Sistemas Computacionales</ContextItem>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatChip({
  className,
  style,
  label,
  initial,
}: {
  className: string;
  style: React.CSSProperties;
  label: string;
  initial: false | 'hidden';
}) {
  return (
    <motion.div
      className={`absolute z-[2] items-center gap-2 whitespace-nowrap ${className}`}
      style={{
        padding: '9px 16px',
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: '999px',
        boxShadow:
          '0 10px 30px -8px rgba(26,26,36,0.12), 0 2px 6px rgba(26,26,36,0.04)',
        fontSize: '13px',
        fontWeight: 500,
        ...style,
      }}
      variants={fadeIn}
      initial={initial}
      animate="visible"
      transition={{ duration: 0.6, ease: easeOut, delay: 1.2 }}
      whileHover={{ scale: 1.05, transition: { duration: 0.2, ease: easeOut } }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--color-carbon)',
        }}
      />
      <span>{label}</span>
    </motion.div>
  );
}

function ConvoMsg({
  speakerLabel,
  speakerInitial,
  text,
}: {
  speakerLabel: string;
  speakerInitial: string;
  text: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--line)',
        padding: '14px 16px',
        borderRadius: '12px',
        marginBottom: '12px',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          marginBottom: '6px',
        }}
      >
        <span
          className="flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--coral-soft)',
            border: '1px solid rgba(255,123,92,0.3)',
            color: 'var(--color-coral-text)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: '10px',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {speakerInitial}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {speakerLabel}
        </span>
      </div>
      <div
        className="text-left"
        style={{
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--color-carbon)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function RightLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--text-mute)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: '8px',
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: 'rgba(26, 26, 36, 0.35)',
        }}
      />
      {children}
    </div>
  );
}

function ContextItem({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2"
      style={{
        fontSize: '12px',
        lineHeight: 1.6,
        padding: '3px 0',
        color: 'var(--color-carbon)',
      }}
    >
      <span
        style={{
          color: 'var(--color-coral-text)',
          fontWeight: 700,
          lineHeight: 1.6,
        }}
      >
        ✓
      </span>
      <span>{children}</span>
    </div>
  );
}
