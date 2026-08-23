import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/site';

// Crawlable but not indexable — see NOINDEX_PATHS in lib/site.ts for why this
// is a meta tag rather than a robots.txt Disallow.
export const metadata: Metadata = noIndexMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
