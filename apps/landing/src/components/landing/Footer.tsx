import { BrandMark } from './BrandMark';

/**
 * Footer: 4-column grid + bottom copyright row.
 * Source: design_susurra/index.html lines 1009-1052.
 */
export function Footer() {
  return (
    <footer
      style={{
        background: 'var(--color-carbon)',
        color: 'var(--color-ivory)',
        padding: '64px 0 32px',
      }}
    >
      <div className="max-w-[1240px] mx-auto px-8">
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10"
          style={{
            paddingBottom: '48px',
            borderBottom: '1px solid rgba(245,239,230,0.1)',
          }}
        >
          {/* Brand */}
          <div className="md:col-span-2 lg:col-span-1">
            <BrandMark variant="footer" href="/" />
            <p
              style={{
                fontSize: '14px',
                color: 'rgba(245,239,230,0.6)',
                maxWidth: '280px',
                lineHeight: 1.6,
              }}
            >
              El copilot íntimo para devs LATAM en conversaciones que importan.
            </p>
          </div>

          <FooterCol title="Producto">
            <FooterLink href="#como-funciona">Cómo funciona</FooterLink>
            <FooterLink href="#diferencia">Por qué Susurra</FooterLink>
            <FooterLink href="#faq">FAQ</FooterLink>
            <FooterLink href="#waitlist">Pedir invitación</FooterLink>
          </FooterCol>

          <FooterCol title="Sobre">
            <FooterLink href="#founder">Founder</FooterLink>
            <FooterLink href="mailto:luiscodecarranza@gmail.com">
              Contacto
            </FooterLink>
            <FooterLink
              href="https://www.linkedin.com/in/lucadevv"
              external
            >
              LinkedIn
            </FooterLink>
          </FooterCol>

          <FooterCol title="Legal">
            <FooterLink href="#privacy">Privacidad</FooterLink>
            <FooterLink href="#terms">Términos</FooterLink>
          </FooterCol>
        </div>

        <div
          className="flex flex-wrap justify-between items-center gap-3"
          style={{
            paddingTop: '28px',
            fontSize: '12px',
            color: 'rgba(245,239,230,0.4)',
          }}
        >
          <span>
            © 2026 Luis Carranza, LLC · Todos los derechos reservados.
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              color: 'var(--color-coral)',
              fontSize: '14px',
            }}
          >
            Hecho con coral desde Perú.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-coral)',
          marginBottom: '18px',
        }}
      >
        {title}
      </h4>
      <ul className="list-none flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <li>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="transition-colors hover:text-coral"
        style={{
          fontSize: '14px',
          color: 'rgba(245,239,230,0.75)',
        }}
      >
        {children}
      </a>
    </li>
  );
}
