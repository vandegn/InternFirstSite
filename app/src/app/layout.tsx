import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { SITE_URL, SITE_NAME } from '@/lib/site';

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

  // Site-wide social defaults. Unlike a canonical, an inherited OG card is a
  // safe fallback rather than a bug: a page that forgets to set its own still
  // shares as a correct, generic InternFirst card instead of as a bare link.
  // Public pages override these via `pageMetadata()` in lib/site.ts.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    url: SITE_URL,
    title: SITE_NAME,
    description:
      'Connecting ambitious students, world-class employers, and leading universities in one premium platform.',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description:
      'Connecting ambitious students, world-class employers, and leading universities in one premium platform.',
  },
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
