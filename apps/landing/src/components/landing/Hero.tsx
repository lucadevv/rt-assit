/**
 * Hero section: pill badge + headline + lead + dual CTAs + product mockup
 * with floating annotation chips.
 * Source: design_susurra/index.html lines 712-786.
 */
export function Hero() {
  return (
    <section
      className="relative text-center"
      style={{ padding: '136px 0 100px' /* 56 + 80 to clear fixed nav */ }}
    >
      {/* Ambient coral glow */}
      <div
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
            'radial-gradient(ellipse at center top, rgba(255,123,92,0.18) 0%, rgba(255,123,92,0.06) 30%, transparent 65%)',
        }}
      />

      <div className="relative z-[1] max-w-[1240px] mx-auto px-8">
        {/* Pill badge */}
        <div
          className="inline-flex items-center gap-2 mb-8 rounded-full"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-coral-deep)',
            padding: '7px 16px',
            border: '1px solid rgba(255,123,92,0.28)',
            background: 'rgba(255,123,92,0.05)',
          }}
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
        </div>

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
          Te susurra qué decir.
          <br />
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--color-coral)',
              fontSize: 'clamp(48px, 9.5vw, 100px)',
              letterSpacing: '-0.025em',
            }}
          >
            Vos brillás.
          </span>
        </h1>

        {/* Lead */}
        <p
          className="mx-auto"
          style={{
            fontSize: 'clamp(16px, 2vw, 19px)',
            color: 'var(--text-dim)',
            maxWidth: '580px',
            margin: '0 auto 38px',
            lineHeight: 1.55,
          }}
        >
          El copilot íntimo para devs LATAM. Susurra escucha tu llamada y te
          sugiere la respuesta exacta, en tu español, basada en tu CV y tu rol.
        </p>

        {/* CTA row */}
        <div className="inline-flex gap-3 flex-wrap justify-center mb-16">
          <a
            href="#waitlist"
            className="rounded-full font-semibold transition-transform hover:-translate-y-[2px]"
            style={{
              background: 'var(--color-coral)',
              color: 'var(--color-carbon)',
              padding: '14px 26px',
              fontSize: '15px',
              boxShadow: '0 6px 20px -6px rgba(255,123,92,0.5)',
            }}
          >
            Pedir invitación →
          </a>
          <a
            href="#como-funciona"
            className="rounded-full font-medium transition-colors hover:bg-white"
            style={{
              background: 'rgba(255,255,255,0.6)',
              color: 'var(--color-carbon)',
              padding: '14px 22px',
              fontSize: '15px',
              border: '1px solid var(--line)',
            }}
          >
            Ver cómo funciona
          </a>
        </div>

        {/* Product mockup */}
        <ProductMockup />
      </div>
    </section>
  );
}

function ProductMockup() {
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
      />
      <FloatChip
        className="hidden min-[880px]:flex anim-float-b"
        style={{ top: 60, right: -12 }}
        label="100% privado"
      />
      <FloatChip
        className="hidden min-[880px]:flex anim-float-a-rev"
        style={{ top: 220, left: -30 }}
        label="40+ idiomas"
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
                      color: 'var(--color-coral-deep)',
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
              speaker="🎙 Entrevistador"
              text={
                <>
                  &ldquo;Tell me about a{' '}
                  <em
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontStyle: 'italic',
                      color: 'var(--color-coral-deep)',
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
              speaker="👤 Vos"
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
                  background: 'var(--color-ivory)',
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
}: {
  className: string;
  style: React.CSSProperties;
  label: string;
}) {
  return (
    <div
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
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--color-coral)',
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function ConvoMsg({
  speaker,
  text,
}: {
  speaker: string;
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
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--text-mute)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}
      >
        {speaker}
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
          background: 'var(--color-coral)',
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
          color: 'var(--color-coral-deep)',
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
