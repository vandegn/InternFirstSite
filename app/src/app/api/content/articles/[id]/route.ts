import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSupabase } from '@/lib/supabase-server';
import { authorizeContentRequest } from '@/lib/content-route-auth';
import { ARTICLE_LIMITS, isValidSlug, slugify, type ArticleStatus, type ContentAudience } from '@/lib/content-articles';

// Admin edits to one article — title, slug, body, FAQ, status. It exists as a
// route rather than a direct Supabase update so that publishing can also
// revalidate the ISR'd public pages: /blog, /blog/[slug], /llms.txt and the
// sitemap would otherwise show a new guide up to an hour late.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: ArticleStatus[] = ['draft', 'published', 'archived'];
const AUDIENCES: ContentAudience[] = ['student', 'employer', 'both'];

type Patch = {
  title?: string;
  slug?: string;
  description?: string;
  body_markdown?: string;
  key_takeaways?: string[];
  faq?: { question: string; answer: string }[];
  tags?: string[];
  audience?: ContentAudience;
  status?: ArticleStatus;
  published_at?: string | null;
  reviewed_by?: string | null;
};

function stringList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean).slice(0, max);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorizeContentRequest(req, { allowCron: false });
  if (!auth.ok) return auth.res;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });

  const patch: Patch = {};
  if (typeof body.title === 'string') {
    const title = body.title.replace(/\s+/g, ' ').trim();
    if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = title;
  }
  if (typeof body.slug === 'string') {
    const slug = slugify(body.slug);
    if (!slug || !isValidSlug(slug)) return NextResponse.json({ error: 'Slug must be lowercase words joined by hyphens' }, { status: 400 });
    patch.slug = slug;
  }
  if (typeof body.description === 'string') {
    const description = body.description.replace(/\s+/g, ' ').trim();
    if (!description || description.length > ARTICLE_LIMITS.descriptionMax) {
      return NextResponse.json({ error: `Description must be 1-${ARTICLE_LIMITS.descriptionMax} characters` }, { status: 400 });
    }
    patch.description = description;
  }
  if (typeof body.body_markdown === 'string') {
    if (!body.body_markdown.trim()) return NextResponse.json({ error: 'Body cannot be empty' }, { status: 400 });
    patch.body_markdown = body.body_markdown;
  }
  const takeaways = stringList(body.key_takeaways, ARTICLE_LIMITS.takeawaysMax);
  if (takeaways) patch.key_takeaways = takeaways;
  const tags = stringList(body.tags, ARTICLE_LIMITS.tagsMax);
  if (tags) patch.tags = tags.map((t) => t.toLowerCase());
  if (Array.isArray(body.faq)) {
    patch.faq = body.faq
      .filter((f): f is { question: string; answer: string } => Boolean(f) && typeof f === 'object' && typeof (f as { question?: unknown }).question === 'string' && typeof (f as { answer?: unknown }).answer === 'string')
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question && f.answer)
      .slice(0, ARTICLE_LIMITS.faqMax);
  }
  if (typeof body.audience === 'string') {
    if (!AUDIENCES.includes(body.audience as ContentAudience)) return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
    patch.audience = body.audience as ContentAudience;
  }

  const db = getAdminSupabase();
  const { data: before, error: readError } = await db
    .from('content_articles')
    .select('id, slug, status, published_at')
    .eq('id', id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: 'Article not found' }, { status: 404 });

  if (typeof body.status === 'string') {
    if (!STATUSES.includes(body.status as ArticleStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = body.status as ArticleStatus;
    if (patch.status === 'published') {
      // Keep the original publish date on re-publish so dateModified, not
      // datePublished, is what moves when an admin edits a live guide.
      patch.published_at = before.published_at ?? new Date().toISOString();
      patch.reviewed_by = auth.userId;
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data: after, error } = await db.from('content_articles').update(patch).eq('id', id).select('*').single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    const message = error.code === '23505' ? 'That slug is already in use' : error.message;
    return NextResponse.json({ error: message }, { status });
  }

  // Anything that could have changed what the public sees. Cheap, and it
  // means "Publish" is live immediately rather than at the next ISR tick.
  const touchedPublic = before.status === 'published' || after.status === 'published';
  if (touchedPublic) {
    revalidatePath('/blog');
    revalidatePath(`/blog/${before.slug}`);
    if (after.slug !== before.slug) revalidatePath(`/blog/${after.slug}`);
    revalidatePath('/llms.txt');
    revalidatePath('/sitemap.xml');
  }

  return NextResponse.json({ article: after }, { headers: { 'Cache-Control': 'no-store' } });
}
