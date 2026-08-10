import { Archivo, Azeret_Mono, Saira_Stencil_One } from 'next/font/google';
import './globals.css';

const ui = Archivo({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const data = Azeret_Mono({
  subsets: ['latin'],
  variable: '--font-data',
  display: 'swap',
});

const stencil = Saira_Stencil_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-stencil',
  display: 'swap',
});

export const metadata = {
  title: 'Sunset Motors — Boleta de cobro',
  description: 'Calculadora de cobros del taller Sunset Motors.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#15171b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${ui.variable} ${data.variable} ${stencil.variable}`}>
      <body>{children}</body>
    </html>
  );
}
