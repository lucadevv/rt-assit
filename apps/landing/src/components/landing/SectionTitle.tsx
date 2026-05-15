import type { ReactNode } from 'react';

type SectionTitleProps = {
  eyebrow: string;
  heading: ReactNode;
  description?: ReactNode;
  invert?: boolean;
};

/**
 * Shared section header (eyebrow + h2 with optional serif italic span + lead).
 * Source: design_susurra/index.html lines 346-371.
 */
export function SectionTitle({
  eyebrow,
  heading,
  description,
  invert = false,
}: SectionTitleProps) {
  return (
    <div className="text-center mb-16">
      <span
        className="block"
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: invert ? 'var(--color-coral)' : 'var(--color-coral-deep)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}
      >
        {eyebrow}
      </span>
      <h2
        className="mx-auto"
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: 'clamp(32px, 5vw, 52px)',
          lineHeight: 1.05,
          letterSpacing: '-0.035em',
          maxWidth: '720px',
          margin: '0 auto',
          color: invert ? 'var(--color-ivory)' : 'var(--color-carbon)',
        }}
      >
        {heading}
      </h2>
      {description && (
        <p
          className="mx-auto"
          style={{
            fontSize: '17px',
            color: invert
              ? 'rgba(245,239,230,0.7)'
              : 'var(--text-dim)',
            maxWidth: '540px',
            margin: '20px auto 0',
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/** Helper for the italic-coral fragment inside an h2 heading. */
export function SerifEm({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        color: 'var(--color-coral)',
        fontWeight: 400,
        fontSize: 'clamp(36px, 5.5vw, 60px)',
      }}
    >
      {children}
    </span>
  );
}
