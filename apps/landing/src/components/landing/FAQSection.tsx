import type { ReactNode } from 'react';
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
 * FAQ section: 5 collapsible items using native <details>/<summary>.
 * Source: design_susurra/index.html lines 963-1007.
 */
export function FAQSection() {
  return (
    <section id="faq" className="relative" style={{ padding: '96px 0' }}>
      <div className="max-w-[1240px] mx-auto px-8">
        <SectionTitle
          eyebrow="FAQ"
          heading={
            <>
              Preguntas <SerifEm>honestas.</SerifEm>
            </>
          }
        />

        <div
          className="mx-auto flex flex-col gap-1"
          style={{ maxWidth: '720px' }}
        >
          {ITEMS.map((item) => (
            <details
              key={item.q}
              className="faq-item group"
              style={{
                background: 'white',
                border: '1px solid var(--line)',
                borderRadius: '14px',
                overflow: 'hidden',
              }}
            >
              <summary
                className="flex items-center justify-between cursor-pointer transition-colors hover:bg-[rgba(245,239,230,0.5)]"
                style={{
                  padding: '22px 26px',
                  listStyle: 'none',
                  fontWeight: 500,
                  fontSize: '17px',
                }}
              >
                <span>{item.q}</span>
                <span
                  className="transition-transform group-open:rotate-45"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '28px',
                    color: 'var(--color-coral)',
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <div
                style={{
                  padding: '0 26px 24px',
                  fontSize: '15px',
                  color: 'var(--text-dim)',
                  lineHeight: 1.65,
                }}
              >
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
