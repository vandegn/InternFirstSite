import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-server';
import { authorizeCronOrAdmin } from '@/lib/cron-or-admin-auth';
import { createCareerEventsRepo } from '@/lib/career-events-repo';
import { httpFeedFetcher, runCareerEventsSync } from '@/lib/career-events-service';

// Pulls every active iCal source, upserts its events, and sends favorite
// reminders + new-major-event notifications. Called two ways:
//   * hourly by pg_cron (migrations/20261009_career_events_cron.sql) with the
//     x-cron-secret header — or by a Vercel cron with Authorization: Bearer;
//   * by an admin pressing "Sync now" on /dashboard/admin/events (session auth).
// Optional JSON body / query: { sourceId } to sync a single feed.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const auth = await authorizeCronOrAdmin(req);
  if (!auth.ok) return auth.res;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  let sourceId = req.nextUrl.searchParams.get('sourceId') ?? undefined;
  if (req.method === 'POST') {
    const body = await req.json().catch(() => null) as { sourceId?: unknown } | null;
    if (typeof body?.sourceId === 'string') sourceId = body.sourceId;
  }
  if (sourceId && !/^[0-9a-f-]{36}$/i.test(sourceId)) {
    return NextResponse.json({ error: 'Invalid sourceId' }, { status: 400 });
  }

  try {
    const summary = await runCareerEventsSync(createCareerEventsRepo(getAdminSupabase()), httpFeedFetcher, new Date(), { sourceId });
    return NextResponse.json({ ...summary, via: auth.via }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Career events sync failed:', e);
    return NextResponse.json(
      { error: 'Sync failed. Make sure migrations/20261009_career_events.sql has been applied.' },
      { status: 500 },
    );
  }
}

export const POST = handle;
// Vercel cron issues GET requests.
export const GET = handle;
