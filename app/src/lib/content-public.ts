import { getAnonSupabase } from '@/lib/supabase-server';
import { ARTICLE_COLUMNS, type ContentArticle } from '@/lib/content-articles';

// Server-side reads for the public guide pages, the sitemap and /llms.txt.
// The anon client means the "Published articles are public" RLS policy is the
// whole access control: a draft can't be rendered or advertised by accident.

export type ArticleSummary = Pick<
  ContentArticle,
  'id' | 'slug' | 'title' | 'description' | 'tags' | 'audience' | 'published_at' | 'updated_at'
>;

export async function getPublishedArticles(limit = 200): Promise<ArticleSummary[]> {
  const supabase = getAnonSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('content_articles')
    .select('id, slug, title, description, tags, audience, published_at, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) {
    // Before the migration lands the table doesn't exist; the blog index
    // simply has nothing to show rather than a 500.
    console.error('[content] published articles fetch failed:', error.message);
    return [];
  }
  return (data ?? []) as ArticleSummary[];
}

export async function getPublishedArticle(slug: string): Promise<ContentArticle | null> {
  const supabase = getAnonSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('content_articles')
    .select(ARTICLE_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ContentArticle;
}
