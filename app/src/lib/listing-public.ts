import { getAnonSupabase } from '@/lib/supabase-server';
import type { ListingSection } from '@/lib/supabase';

// Server-side reads for the public listing page. The anon client means RLS
// decides what's visible, exactly as it did when this page fetched from the
// browser — so server-rendering cannot expose a listing the public couldn't
// already open. Same guarantee sitemap.ts relies on.

export type PublicListing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  is_hybrid: boolean;
  compensation: string | null;
  requirements: string | null;
  industry: string;
  created_at: string;
  application_deadline: string | null;
  key_responsibilities: string | null;
  section_order: string[] | null;
  preferred_skills: string[] | null;
  duration: string | null;
  role_tags: string[] | null;
  banner_url: string | null;
  accent_color: string | null;
  status: string | null;
  employers: {
    company_name: string;
    logo_url: string | null;
    website?: string | null;
  };
};

export async function getPublicListing(id: string): Promise<PublicListing | null> {
  const supabase = getAnonSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url, website)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PublicListing;
}

export async function getPublicListingSections(id: string): Promise<ListingSection[]> {
  const supabase = getAnonSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('listing_sections')
    .select('*')
    .eq('listing_id', id)
    .order('position', { ascending: true });

  if (error) return [];
  return (data ?? []) as ListingSection[];
}
