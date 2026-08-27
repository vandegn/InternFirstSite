// The one place the canonical origin is written down. Everything that needs an
// absolute URL — sitemap.xml, robots.txt, metadataBase, OG tags — reads it from
// here, so a domain change is a one-line edit.
//
// Overridable via NEXT_PUBLIC_SITE_URL for preview deploys. Note that Vercel
// preview URLs should NOT be indexed, which robots.ts handles separately.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.intern-first.com'
).replace(/\/$/, '');

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// Paths crawlers must not fetch at all. Nothing here has any search value and
// nothing here is linked from a public page in a way that could get it indexed
// URL-only, so a robots.txt Disallow is the right (and cheapest) tool.
export const DISALLOWED_PATHS = [
  // No trailing slash: robots.txt matches on prefix, so '/dashboard' covers
  // both the exact route and everything under it, while '/dashboard/' would
  // have let /dashboard itself through.
  '/dashboard',
  '/api/',
  // Real routes, both of them: /auth/confirm is the email-link interstitial and
  // /join/[token] is the employer team invite. Neither has search value.
  '/auth/',
  '/join/',
] as const;

// The auth flow. These are deliberately NOT in DISALLOWED_PATHS: /register and
// /login are linked from the site footer, and a Disallow'd URL can still be
// indexed URL-only from those links — worse, blocking the crawl means Google
// never reads the noindex that would have excluded it. So we let crawlers
// fetch these and tell them plainly not to index, via `noIndexMetadata` on a
// layout in each route. `follow: true` keeps link equity flowing back out.
export const NOINDEX_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;

export const noIndexMetadata = {
  robots: { index: false, follow: true },
} as const;
