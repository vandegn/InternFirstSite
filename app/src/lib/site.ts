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

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

// The site-wide social card. Next does NOT copy a page's `title`/`description`
// into its Open Graph tags — an og:title set on the root layout is inherited
// verbatim by every child unless that child overrides it. So rather than let
// every page share one generic card, `pageMetadata` below builds the canonical,
// OG and Twitter blocks from the same title/description in one place.
export const SITE_NAME = 'InternFirst';

// `src/app/opengraph-image.tsx` generates the card via Next's file convention
// and serves it at this path. The convention injects og:image automatically —
// but only into segments that don't declare their own `openGraph`. A page that
// sets openGraph.title replaces the whole inherited object, image included, so
// every page built by `pageMetadata` has to name the image explicitly. (Verified
// the hard way: /about, /privacy and /terms shipped with no og:image at all.)
//
// To swap in designed artwork, replace opengraph-image.tsx with a 1200x630
// `opengraph-image.png` and change this url to '/opengraph-image.png'.
export const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'InternFirst — internships for verified students, from reviewed employers.',
} as const;

type PageMetaInput = {
  /**
   * Page title WITHOUT the "| InternFirst" suffix — the root layout's
   * `%s | InternFirst` template appends it. Passing a title that already
   * contains the brand is what produced "Privacy Policy | InternFirst |
   * InternFirst"; use `absoluteTitle` instead when the brand must sit inside
   * the title.
   */
  title?: string;
  /** Complete title, used verbatim. Bypasses the root template entirely. */
  absoluteTitle?: string;
  description: string;
  /** Site-root-relative path, e.g. '/about'. Becomes the self-referencing canonical. */
  path: string;
};

// Every public, indexable page's metadata goes through here so a page can't
// ship with a canonical but no OG card, or vice versa.
export function pageMetadata({ title, absoluteTitle, description, path }: PageMetaInput) {
  const url = absoluteUrl(path);
  // Social cards have no template to fall back on, so they always carry the
  // brand explicitly.
  const fullTitle = absoluteTitle ?? `${title} | ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website' as const,
      siteName: SITE_NAME,
      locale: 'en_US',
      url,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: fullTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
