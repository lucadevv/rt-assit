import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Susurra — Te susurra qué decir. Vos brillás.',
  description:
    'El copilot íntimo para conversaciones que importan. Entrevistas, llamadas con clientes, defensas de tesis — en español, sin perderte palabras.',
  metadataBase: new URL('https://susurra.ai'),
  openGraph: {
    title: 'Susurra',
    description: 'Te susurra qué decir. Vos brillás.',
    images: ['/og-image.svg'],
    locale: 'es_LA',
    type: 'website',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
