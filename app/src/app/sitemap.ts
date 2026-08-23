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
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
};

// Every public, indexable page. Dashboards, admin, the auth flow, /join/[token]
// and /api/* are deliberately absent — see DISALLOWED_PATHS in lib/site.ts.
const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/internships', priority: 0.9, changeFrequency: 'daily' },
  { path: '/career-resources', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/home', priority: 0.6, changeFrequency: 'monthly' },
  // Placeholder marketing content today. Once real posts exist they belong in
  // the dynamic block below, keyed off whatever stores them.
  { path: '/blog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/waitlist', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
];

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
    ...STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
      url: `${SITE_URL}${path === '/' ? '' : path}`,
      lastModified: now,
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
