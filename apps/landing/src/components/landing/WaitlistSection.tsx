import { SectionTitle, SerifEm } from './SectionTitle';

const TALLY_FORM_ID = 'PLACEHOLDER_FORM_ID';

/**
 * Waitlist section: Tally.so embed wrapper on dark carbon background.
 * Source: design_susurra/index.html lines 921-961.
 *
 * TODO: replace TALLY_FORM_ID with the real Tally form ID once provisioned.
 */
export function WaitlistSection() {
  const tallySrc = `https://tally.so/embed/${TALLY_FORM_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <section
      id="waitlist"
      className="relative"
      style={{
        padding: '96px 0',
        background: 'var(--color-carbon)',
        color: 'var(--color-ivory)',
      }}
    >
      <div className="max-w-[1240px] mx-auto px-8">
        <SectionTitle
          eyebrow="Acceso anticipado"
          heading={
            <>
              Estoy <SerifEm>onboarding</SerifEm> personalmente cada beta tester.
            </>
          }
          description="Cada acceso lo doy en una llamada de 20 minutos con vos. Quiero entender cómo lo vas a usar y ajustar Susurra a tu realidad."
          invert
        />

        <div
          className="mx-auto"
          style={{
            maxWidth: '720px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(245,239,230,0.12)',
            borderRadius: '18px',
            padding: '32px',
          }}
        >
          {isDev && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-coral)',
                marginBottom: '16px',
                padding: '8px 12px',
                border: '1px dashed rgba(255,123,92,0.4)',
                borderRadius: '8px',
              }}
            >
              <strong>Pendiente (dev only):</strong> reemplazar
              {' '}<code>PLACEHOLDER_FORM_ID</code>{' '}
              con el form ID real de Tally cuando esté listo.
            </p>
          )}

          <p
            className="text-center"
            style={{
              fontSize: '14px',
              color: 'rgba(245,239,230,0.7)',
              marginBottom: '20px',
              lineHeight: 1.55,
            }}
          >
            Sin spam, sin compromisos. Te aviso solo cuando arranque la beta.
          </p>

          <iframe
            src={tallySrc}
            loading="lazy"
            width="100%"
            height="520"
            title="Susurra waitlist form"
            style={{
              border: 'none',
              borderRadius: '12px',
              background: 'transparent',
              minHeight: '520px',
            }}
          />

          <p
            className="text-center"
            style={{
              fontSize: '12px',
              color: 'rgba(245,239,230,0.5)',
              marginTop: '16px',
              lineHeight: 1.5,
            }}
          >
            Sin spam. Sin venderte data. Te aviso por email cuando haya lugar.
          </p>
        </div>

        <div className="text-center mt-6">
          <div
            className="inline-flex items-baseline gap-2"
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '22px',
              color: 'var(--color-coral)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontStyle: 'normal',
                fontSize: '14px',
                color: 'rgba(245,239,230,0.6)',
                fontWeight: 500,
              }}
            >
              Estado:
            </span>
            beta privada · cupos limitados
          </div>
        </div>
      </div>
    </section>
  );
}
