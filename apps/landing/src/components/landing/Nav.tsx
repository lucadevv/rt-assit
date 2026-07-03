'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { easeOut } from '@/lib/motion-presets';
import { BrandMark } from './BrandMark';

/**
 * Fixed-top navigation bar with sticky blurred backdrop, anchor links and CTA.
 * Source: design_susurra/index.html lines 691-710.
 */
export function Nav() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(245, 239, 230, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(26, 26, 36, 0.06)',
      }}
      initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut }}
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
            className="rounded-full px-[18px] py-[9px] text-[13px] font-medium transition-transform duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-[2px] active:scale-[0.97]"
            style={{
              background: 'var(--color-carbon)',
              color: 'var(--color-ivory)',
            }}
          >
            Pedir invitación →
          </a>
        </nav>
      </div>
    </motion.header>
  );
}
