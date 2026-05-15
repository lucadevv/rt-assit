import { BrandMark } from './BrandMark';

/**
 * Fixed-top navigation bar with sticky blurred backdrop, anchor links and CTA.
 * Source: design_susurra/index.html lines 691-710.
 */
export function Nav() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(245, 239, 230, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(26, 26, 36, 0.06)',
      }}
    >
      <div className="max-w-[1240px] mx-auto px-8">
        <nav
          aria-label="Navegación principal"
          className="flex items-center justify-between py-3.5"
        >
          <BrandMark variant="nav" href="/" />

          <div
            className="hidden md:flex gap-7 text-[14px] font-medium"
            style={{ color: 'var(--text-dim)' }}
          >
            <a
              href="#como-funciona"
              className="transition-colors hover:text-carbon"
            >
              Cómo funciona
            </a>
            <a
              href="#diferencia"
              className="transition-colors hover:text-carbon"
            >
              Por qué Susurra
            </a>
            <a href="#founder" className="transition-colors hover:text-carbon">
              Sobre mí
            </a>
            <a href="#faq" className="transition-colors hover:text-carbon">
              FAQ
            </a>
          </div>

          <a
            href="#waitlist"
            className="rounded-full px-[18px] py-[9px] text-[13px] font-medium transition-transform hover:-translate-y-[1px]"
            style={{
              background: 'var(--color-carbon)',
              color: 'var(--color-ivory)',
            }}
          >
            Pedir invitación →
          </a>
        </nav>
      </div>
    </header>
  );
}
