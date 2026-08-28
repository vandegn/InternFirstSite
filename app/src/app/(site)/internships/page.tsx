import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAnonSupabase } from '@/lib/supabase-server';
import { pageMetadata } from '@/lib/site';
import InternshipsBrowser, { type Listing } from './InternshipsBrowser';

// This page used to be a pure client component: the server sent
// "Loading internships..." and every listing link only existed after the
// browser ran JS, so crawlers saw a job board with zero jobs on it. The first
// unfiltered page is now fetched here and rendered into the HTML; the browser
// takes over from there for search, filters and paging.
//
// ISR rather than per-request rendering — listings change on the order of
// hours, and this keeps crawler traffic off the database.
export const revalidate = 3600;

const PAGE_SIZE = 24;

export const metadata: Metadata = pageMetadata({
  title: 'Browse Internships',
  description:
    'Browse open internships from reviewed employers on InternFirst. Search by role, company, or industry — no signup needed to look.',
  path: '/internships',
});

// Mirrors getActiveListings(1, PAGE_SIZE) with no filters, which is exactly
// what the client would have requested on mount. The anon key means RLS decides
// what's visible, so this can never server-render a listing the public can't
// open.
async function fetchFirstPage(): Promise<{ listings: Listing[]; totalCount: number }> {
  const supabase = getAnonSupabase();
  if (!supabase) return { listings: [], totalCount: 0 };

  const today = new Date().toISOString().slice(0, 10);

  const { data, error, count } = await supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)', { count: 'exact' })
    .eq('status', 'active')
    .or(`application_deadline.is.null,application_deadline.gte.${today}`)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (error) {
    // Degrade to the client fetch rather than 500 the page — the browser will
    // load the same query on mount and the visitor sees the grid either way.
    console.error('[internships] server fetch failed:', error.message);
    return { listings: [], totalCount: 0 };
  }

  return {
    listings: (data ?? []) as unknown as Listing[],
    totalCount: count ?? 0,
  };
}

export default async function PublicInternshipsPage() {
  const { listings, totalCount } = await fetchFirstPage();

  return (
    <>
      <Header />
      <InternshipsBrowser initialListings={listings} initialTotalCount={totalCount} />
      <Footer />
    </>
  );
}
