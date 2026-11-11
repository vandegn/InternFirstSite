import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-server';
import { authorizeContentRequest } from '@/lib/content-route-auth';
import { runContentGeneration } from '@/lib/content-generation';
import { createContentRepo } from '@/lib/content-generation-repo';
import { createClaudeWriter } from '@/lib/content-generation-claude';

// Runs the content agent: takes queued content_topics and writes
// content_articles drafts. Called two ways:
//   * on a schedule (pg_cron / Vercel cron / scripts/generate-articles.mjs)
//     with the x-cron-secret header or Authorization: Bearer $CRON_SECRET;
//   * by an admin pressing "Generate" on /dashboard/admin/content.
// Body / query: { limit?: 1-10, topicId?: uuid }. Nothing is published here.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// One guide is a long generation; several in one call need the headroom.
export const maxDuration = 300;

async function handle(req: NextRequest) {
  const auth = await authorizeContentRequest(req);
  if (!auth.ok) return auth.res;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 503 });
  }

  let limit = Number(req.nextUrl.searchParams.get('limit') ?? 1);
  let topicId = req.nextUrl.searchParams.get('topicId') ?? undefined;
  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { limit?: unknown; topicId?: unknown } | null;
    if (typeof body?.limit === 'number') limit = body.limit;
    if (typeof body?.topicId === 'string') topicId = body.topicId;
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 10) {
    return NextResponse.json({ error: 'limit must be between 1 and 10' }, { status: 400 });
  }
  if (topicId && !/^[0-9a-f-]{36}$/i.test(topicId)) {
    return NextResponse.json({ error: 'Invalid topicId' }, { status: 400 });
  }

  try {
    const summary = await runContentGeneration(createContentRepo(getAdminSupabase()), createClaudeWriter(), {
      limit,
      topicId,
    });
    return NextResponse.json({ ...summary, via: auth.via }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Content generation failed:', e);
    return NextResponse.json(
      { error: 'Generation failed. Make sure migrations/20261111_content_articles.sql has been applied.' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
