'use client';

import { useId, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  easeOutQuart,
  fadeIn,
  fadeUpSubtle,
  staggerContainer,
  viewportOnce,
} from '@/lib/motion-presets';
import { SectionTitle, SerifEm } from './SectionTitle';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8767';

type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistSection() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ status: 'idle' });
  const inputId = useId();
  const statusId = useId();

  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? { initial: false as const, animate: 'visible' as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: viewportOnce,
      };

  const isLoading = state.status === 'loading';
  const isSuccess = state.status === 'success';
  const isError = state.status === 'error';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || isSuccess) return;

    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setState({
        status: 'error',
        message: 'Ingresá un email válido para pedir la invitación.',
      });
      return;
    }

    setState({ status: 'loading' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'landing' }),
      });

      if (res.status === 200) {
        const data = (await res.json().catch(() => null)) as
          | { success?: boolean; message?: string }
          | null;
        setState({
          status: 'success',
          message:
            data?.message ?? 'Recibido. Te contactamos por email pronto.',
        });
        setEmail('');
        return;
      }

      if (res.status === 400 || res.status === 422) {
        setState({
          status: 'error',
          message: 'Revisá el email. No es un formato válido.',
        });
        return;
      }

      if (res.status === 429) {
        setState({
          status: 'error',
          message:
            'Demasiados intentos. Probá de nuevo en una hora.',
        });
        return;
      }

      setState({
        status: 'error',
        message:
          'No pudimos registrar tu solicitud. Probá de nuevo en un momento.',
      });
    } catch {
      setState({
        status: 'error',
        message:
          'Falló la conexión. Revisá tu red e intentá de nuevo.',
      });
    }
  }

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
        <motion.div variants={staggerContainer(0, 0.2)} {...reveal}>
          <motion.div variants={fadeUpSubtle} transition={{ duration: 0.6, ease: easeOutQuart }}>
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
          </motion.div>

          <motion.div
            className="mx-auto"
            style={{
              maxWidth: '560px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(245,239,230,0.12)',
              borderRadius: '18px',
              padding: '32px',
            }}
            variants={fadeUpSubtle}
            transition={{ duration: 0.7, ease: easeOutQuart }}
          >
            <p
              className="text-center"
              style={{
                fontSize: '14px',
                color: 'rgba(245,239,230,0.7)',
                marginBottom: '24px',
                lineHeight: 1.55,
              }}
            >
              Silencioso, atento, preciso. Sin spam, sin compromisos. Te aviso solo cuando arranque la beta.
            </p>

            <form
              onSubmit={onSubmit}
              noValidate
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxWidth: '480px',
                margin: '0 auto',
              }}
            >
              <label
                htmlFor={inputId}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0,0,0,0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                Tu email
              </label>

              <input
                id={inputId}
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (isError) setState({ status: 'idle' });
                }}
                disabled={isLoading || isSuccess}
                aria-invalid={isError}
                aria-describedby={statusId}
                required
                style={inputStyle(isError)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-coral)';
                  e.currentTarget.style.boxShadow =
                    '0 0 0 3px rgba(255,123,92,0.25)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = isError
                    ? 'var(--color-coral)'
                    : 'rgba(245,239,230,0.18)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />

              <button
                type="submit"
                aria-disabled={isLoading || isSuccess}
                disabled={isLoading || isSuccess}
                style={buttonStyle(isLoading || isSuccess)}
              >
                {isLoading ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <Spinner />
                    Enviando…
                  </span>
                ) : isSuccess ? (
                  'Solicitud recibida'
                ) : (
                  <>
                    Pedir invitación{' '}
                    <span aria-hidden="true" style={{ marginLeft: 2 }}>
                      &rarr;
                    </span>
                  </>
                )}
              </button>

              <div
                id={statusId}
                aria-live="polite"
                role="status"
                style={{ minHeight: '24px', marginTop: '4px' }}
              >
                <AnimatePresence mode="wait">
                  {isSuccess && (
                    <motion.p
                      key="success"
                      variants={fadeIn}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      transition={{ duration: 0.4, ease: easeOutQuart }}
                      style={statusMessageStyle('success')}
                    >
                      {state.message}
                    </motion.p>
                  )}
                  {isError && (
                    <motion.p
                      key="error"
                      variants={fadeIn}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      transition={{ duration: 0.3, ease: easeOutQuart }}
                      style={statusMessageStyle('error')}
                    >
                      {state.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </form>

            <p
              className="text-center"
              style={{
                fontSize: '12px',
                color: 'rgba(245,239,230,0.5)',
                marginTop: '20px',
                lineHeight: 1.5,
              }}
            >
              Sin spam. Sin venderte data. Te aviso por email cuando haya lugar.
            </p>
          </motion.div>

          <motion.div
            className="text-center mt-6"
            variants={fadeUpSubtle}
            transition={{ duration: 0.6, ease: easeOutQuart }}
          >
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
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function inputStyle(isError: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '14px 18px',
    fontSize: '16px',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-ivory)',
    background: 'rgba(245,239,230,0.06)',
    border: `1px solid ${
      isError ? 'var(--color-coral)' : 'rgba(245,239,230,0.18)'
    }`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition:
      'border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)',
  };
}

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '14px 26px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: '#FFFFFF',
    background: disabled
      ? 'rgba(255,123,92,0.55)'
      : 'var(--color-coral)',
    border: 'none',
    borderRadius: '999px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition:
      'background-color var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out)',
    letterSpacing: '0.01em',
  };
}

function statusMessageStyle(
  variant: 'success' | 'error',
): CSSProperties {
  return {
    fontSize: '14px',
    lineHeight: 1.5,
    margin: 0,
    color:
      variant === 'success'
        ? 'var(--color-coral)'
        : 'rgba(255,180,160,0.95)',
    fontWeight: 500,
    textAlign: 'center',
  };
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.35)',
        borderTopColor: '#FFFFFF',
        borderRadius: '50%',
        animation: 'waitlist-spin 0.8s linear infinite',
      }}
    >
      <style>{`@keyframes waitlist-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
