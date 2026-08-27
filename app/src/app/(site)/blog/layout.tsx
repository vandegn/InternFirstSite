import type { Metadata } from 'next';

// Every card on /blog today is placeholder content: duplicated titles, a
// hardcoded March 2024 date, and "Learn more" links that all point at "#".
// Indexing that puts thin, dead-ended pages under our domain. `follow: true`
// still lets link equity pass through to the real pages in the header/footer.
//
// Delete this file the day real posts ship, and add /blog (plus each post) back
// to app/sitemap.ts.
export const metadata: Metadata = {
  title: 'Blog',
  robots: { index: false, follow: true },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
