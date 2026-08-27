import type { MetadataRoute } from 'next';
import { getAnonSupabase } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/site';

// Regenerated at most once an hour. A sitemap is a hint, not a contract, so
// hourly is plenty fresh for new listings while keeping this off the hot path
// of every crawler hit. Without this, Next would render the sitemap once at
// build time and new listings would never appear until the next deploy.
export const revalidate = 3600;

// Google's hard cap is 50,000 URLs per sitemap file. We stop well short and
// log if we ever reach it — that's the signal to split into a sitemap index.
const MAX_LISTING_URLS = 45_000;
const PAGE_SIZE = 1000; // PostgREST's default max rows per request

type StaticRoute = {
  path: string;
  // The date this page's content last meaningfully changed, hand-maintained.
  // It must be a real date: emitting `new Date()` here gave all ten URLs the
  // same lastmod and changed it on every crawl, which teaches Google to ignore
  // the field across the whole site. Bump the entry when you edit the page; if
  // you can't say honestly when it changed, drop the field for that route.
  lastModified: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
};

// Every public, indexable page. Dashboards, admin, the auth flow, /join/[token]
// and /api/* are deliberately absent — see DISALLOWED_PATHS in lib/site.ts.
const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', lastModified: '2026-08-03', priority: 1.0, changeFrequency: 'daily' },
  { path: '/internships', lastModified: '2026-08-27', priority: 0.9, changeFrequency: 'daily' },
  { path: '/about', lastModified: '2026-08-02', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', lastModified: '2026-08-03', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/privacy', lastModified: '2026-08-03', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', lastModified: '2026-08-03', priority: 0.3, changeFrequency: 'yearly' },
];

// Deliberately NOT listed, and each for a different reason:
//   /home            — near-duplicate of '/', now 301s there (see next.config.ts)
//   /career-resources— demo shell, noindex until the content is real
//   /blog            — placeholder posts, noindex until real posts ship
//   /waitlist        — superseded by a working /register; product call pending
// Dashboards, admin, the auth flow, /join/[token] and /api/* are absent too —
// see DISALLOWED_PATHS in lib/site.ts.

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ListingRow = {
  id: string;
  updated_at: string | null;
  created_at: string | null;
};

// Mirrors what an anonymous visitor can actually open at /internships/[id]:
// status 'active', employer approved, application deadline not passed. The
// anon RLS policy already enforces the first two; we restate them so a policy
// change can't silently start advertising private URLs to Google.
async function fetchPublicListings(): Promise<ListingRow[]> {
  const supabase = getAnonSupabase();
  if (!supabase) return [];

  const rows: ListingRow[] = [];

  for (let page = 0; rows.length < MAX_LISTING_URLS; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('internship_listings')
      .select('id, updated_at, created_at, employers!inner(verification_status)')
      .eq('status', 'active')
      .eq('employers.verification_status', 'approved')
      .or(`application_deadline.is.null,application_deadline.gte.${todayDateStr()}`)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      // A sitemap that's missing listings beats a 500 that makes Search Console
      // drop the whole file. Serve what we have and leave a trace in the logs.
      console.error('[sitemap] listing fetch failed:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    rows.push(...(data as unknown as ListingRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  if (rows.length >= MAX_LISTING_URLS) {
    console.warn(
      `[sitemap] hit the ${MAX_LISTING_URLS} URL cap — time to split into a sitemap index.`,
    );
  }

  return rows.slice(0, MAX_LISTING_URLS);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const listings = await fetchPublicListings();

  return [
    ...STATIC_ROUTES.map(({ path, lastModified, priority, changeFrequency }) => ({
      // Keep the trailing slash on the homepage so <loc> matches the URL the
      // site actually serves and canonicalises to.
      url: `${SITE_URL}${path}`,
      lastModified: new Date(`${lastModified}T00:00:00Z`),
      changeFrequency,
      priority,
    })),
    ...listings.map((listing) => ({
      url: `${SITE_URL}/internships/${listing.id}`,
      lastModified: new Date(listing.updated_at ?? listing.created_at ?? now),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
