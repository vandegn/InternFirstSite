import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { SITE_URL } from '@/lib/site';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  // Resolves every relative URL in metadata (canonicals, OG images) against the
  // real domain. Without it Next falls back to localhost in dev and emits a
  // build warning, and OG tags ship with unusable relative paths.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'InternFirst',
    template: '%s | InternFirst',
  },
  description:
    'Connecting ambitious students, world-class employers, and leading universities in one premium platform.',
  // Deliberately no `alternates.canonical` here: metadata is inherited, so a
  // canonical set on the root layout would point every page at the homepage
  // and deindex the rest of the site. Canonicals belong on individual pages.
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
