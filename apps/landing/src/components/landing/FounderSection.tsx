/**
 * Founder story section: avatar with "lc" initials + narrative + contact links.
 * Source: design_susurra/index.html lines 887-919.
 */
export function FounderSection() {
  return (
    <section id="founder" className="relative" style={{ padding: '96px 0' }}>
      <div className="max-w-[1240px] mx-auto px-8">
        <div
          className="mx-auto grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 md:gap-14 items-center text-center md:text-left"
          style={{ maxWidth: '880px' }}
        >
          {/* Founder photo (initials "lc") */}
          <div
            className="relative mx-auto md:mx-0 flex items-center justify-center"
            style={{
              aspectRatio: '1 / 1',
              width: '100%',
              maxWidth: '280px',
              borderRadius: '50%',
              background:
                'linear-gradient(145deg, var(--color-coral) 0%, var(--color-coral-deep) 100%)',
              boxShadow: '0 20px 60px -20px rgba(229,90,63,0.4)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: 'var(--color-ivory)',
                fontSize: '100px',
                fontWeight: 400,
                lineHeight: 1,
                paddingBottom: '8px',
              }}
            >
              lc
            </span>
            {/* Shield badge corner */}
            <div
              className="absolute flex items-center justify-center"
              style={{
                bottom: '8px',
                right: '8px',
                width: '56px',
                height: '56px',
                background: 'var(--color-ivory)',
                borderRadius: '50%',
                boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                border: '4px solid var(--color-ivory)',
              }}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                width="26"
                height="26"
              >
                <path
                  d="M12 2L2 7v10c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7l-10-5z"
                  stroke="#FF7B5C"
                  strokeWidth="2"
                  fill="#FF7B5C"
                  fillOpacity="0.15"
                />
              </svg>
            </div>
          </div>

          {/* Story */}
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: 'clamp(28px, 4vw, 42px)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                marginBottom: '22px',
              }}
            >
              Por qué construyo{' '}
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  color: 'var(--color-coral)',
                  fontWeight: 400,
                  fontSize: 'clamp(32px, 4.5vw, 48px)',
                }}
              >
                Susurra.
              </span>
            </h2>
            <FounderParagraph>
              Soy <strong>Luis Carranza Saldaña</strong>, Ingeniero de Sistemas
              Computacionales, dev Flutter mobile de Perú. Llevo 4 años
              construyendo apps y conversando con clientes en inglés.
            </FounderParagraph>
            <FounderParagraph>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  color: 'var(--color-carbon)',
                  fontSize: '18px',
                }}
              >
                Me trabé en una entrevista importante con una empresa de Silicon
                Valley.
              </span>{' '}
              Sabía la respuesta, tenía la experiencia, pero las palabras en
              inglés se me escaparon bajo presión. Esa noche pensé: &ldquo;tiene
              que haber algo mejor que sólo estudiar y rezar.&rdquo;
            </FounderParagraph>
            <FounderParagraph>
              Por eso construyo Susurra. Para que ningún dev LATAM pierda una
              oportunidad por no encontrar las palabras en el momento exacto.
              Si te suma estar en la beta, estamos juntos en esto.
            </FounderParagraph>

            <div className="flex flex-wrap gap-4 mt-6 justify-center md:justify-start">
              <FounderLink href="https://www.linkedin.com/in/lucadevv">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                </svg>
                LinkedIn
              </FounderLink>
              <FounderLink href="mailto:luiscodecarranza@gmail.com">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5z" />
                </svg>
                Escribime directo
              </FounderLink>
              <FounderTag>📍 Perú</FounderTag>
              <FounderTag>Luis Carranza, LLC</FounderTag>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FounderParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '16px',
        lineHeight: 1.7,
        color: 'var(--text-dim)',
        marginBottom: '16px',
      }}
    >
      {children}
    </p>
  );
}

function FounderLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const isExternal = href.startsWith('http');
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-1.5 transition-colors"
      style={{
        fontSize: '13px',
        fontWeight: 500,
        padding: '7px 14px',
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: '999px',
        color: 'var(--color-carbon)',
      }}
    >
      {children}
    </a>
  );
}

function FounderTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: '13px',
        fontWeight: 500,
        padding: '7px 14px',
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: '999px',
        color: 'var(--color-carbon)',
      }}
    >
      {children}
    </span>
  );
}
