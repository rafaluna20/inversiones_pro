import type { Metadata } from 'next';
import { Inter, PT_Sans, Roboto_Slab } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const ptSans = PT_Sans({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-pt-sans' });
const roboSlab = Roboto_Slab({ subsets: ['latin'], variable: '--font-roboto-slab' });

export const metadata: Metadata = {
  title: 'Inversiones Pro - Plataforma de Inversiones Inmobiliarias',
  description: 'Plataforma de inversiones inmobiliarias en Perú. Invierte en propiedades con seguridad y transparencia.',
  keywords: 'inversiones, inmobiliaria, perú, propiedades, terrenos, departamentos',
};

import AppLayout from '@/components/layout/AppLayout';

// ... imports

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${ptSans.variable} ${roboSlab.variable} font-sans`}>
        <Providers>
          <AppLayout>
            {children}
          </AppLayout>
        </Providers>
      </body>
    </html>
  );
}
