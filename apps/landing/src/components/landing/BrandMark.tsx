import type { CSSProperties } from 'react';

type Variant = 'nav' | 'footer';

type BrandMarkProps = {
  variant?: Variant;
  href?: string;
};

/**
 * Susurra wordmark: Inter "susurr" + Instrument Serif italic coral "a" + 3 coral dots.
 * Mirrors .brand-mark from design_susurra/index.html.
 */
export function BrandMark({ variant = 'nav', href = '/' }: BrandMarkProps) {
  const isFooter = variant === 'footer';

  const wrapStyle: CSSProperties = {
    color: isFooter ? 'var(--color-ivory)' : 'var(--color-carbon)',
  };

  const sansStyle: CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: isFooter ? '32px' : '28px',
    letterSpacing: '-0.04em',
    lineHeight: 1,
    color: 'inherit',
  };

  const serifStyle: CSSProperties = {
    fontFamily: 'var(--font-serif)',
    fontStyle: 'italic',
    fontWeight: 400,
    fontSize: isFooter ? '46px' : '40px',
    color: 'var(--color-coral)',
    marginLeft: 1,
    lineHeight: 0.85,
  };

  const dotsWrapStyle: CSSProperties = {
    position: 'absolute',
    top: isFooter ? '-5px' : '-4px',
    right: 0,
    display: 'inline-flex',
    gap: 3,
    alignItems: 'center',
  };

  const dotBase: CSSProperties = {
    display: 'inline-block',
    borderRadius: '50%',
    background: 'var(--color-coral)',
  };

  const dot1: CSSProperties = {
    ...dotBase,
    width: isFooter ? 6 : 5,
    height: isFooter ? 6 : 5,
  };
  const dot2: CSSProperties = {
    ...dotBase,
    width: isFooter ? 4.5 : 4,
    height: isFooter ? 4.5 : 4,
    opacity: 0.6,
  };
  const dot3: CSSProperties = {
    ...dotBase,
    width: 3,
    height: 3,
    opacity: 0.3,
  };

  return (
    <a
      href={href}
      aria-label="Susurra · Inicio"
      style={{
        ...wrapStyle,
        display: 'inline-flex',
        alignItems: 'baseline',
        position: 'relative',
        lineHeight: 1,
        paddingRight: 18,
        textDecoration: 'none',
        marginBottom: isFooter ? 14 : undefined,
      }}
    >
      <span style={sansStyle}>susurr</span>
      <span style={serifStyle}>a</span>
      <span style={dotsWrapStyle} aria-hidden="true">
        <span style={dot1} />
        <span style={dot2} />
        <span style={dot3} />
      </span>
    </a>
  );
}
