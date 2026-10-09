import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getAdminSupabase, getServerSupabase } from '@/lib/supabase-server';
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

function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorize(req: NextRequest): Promise<{ ok: true; via: 'cron' | 'admin' } | { ok: false; res: NextResponse }> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (secretMatches(req.headers.get('x-cron-secret')) || secretMatches(bearer)) return { ok: true, via: 'cron' };

  const db = await getServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile?.role !== 'intern_first_admin') return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ok: true, via: 'admin' };
}

async function handle(req: NextRequest) {
  const auth = await authorize(req);
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
