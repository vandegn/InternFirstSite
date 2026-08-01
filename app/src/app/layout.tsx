import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'InternFirst',
  description:
    'Connecting ambitious students, world-class employers, and leading universities in one premium platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
