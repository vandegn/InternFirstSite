import { NextRequest, NextResponse } from 'next/server';
import schoolsData from '@/data/us-schools.json';
import { getAdminSupabase } from '@/lib/supabase-server';
import { authorizeCronOrAdmin } from '@/lib/cron-or-admin-auth';
import { createFeedDiscoveryRepo } from '@/lib/feed-discovery-repo';
import { httpPageFetcher, runFeedDiscovery } from '@/lib/feed-discovery-service';
import { normalizeDomainInput, type DiscoveryTarget } from '@/lib/feed-discovery';
import { createCareerEventsRepo } from '@/lib/career-events-repo';
import { httpFeedFetcher, runCareerEventsSync } from '@/lib/career-events-service';

// Looks for public iCal feeds at schools, adds the useful ones as event
// sources (tagged to the school, so only its students see them) and pulls
// their events right away. Every feed found is logged in feed_candidates.
// Called two ways:
//   * daily by pg_cron (migrations/20261117_feed_discovery_cron.sql) — checks
//     the schools our students attend that are due (never checked first);
//   * by an admin: "Find feeds now" (same as the cron) or "Check a school"
//     with { schoolId, domain } for one school, students or not.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type SchoolRow = [number, string, string, string];
const SCHOOLS = schoolsData as SchoolRow[];

async function handle(req: NextRequest) {
  const auth = await authorizeCronOrAdmin(req);
  if (!auth.ok) return auth.res;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  let target: DiscoveryTarget | undefined;
  if (req.method === 'POST') {
    const body = await req.json().catch(() => null) as { schoolId?: unknown; domain?: unknown } | null;
    if (body?.schoolId != null || body?.domain != null) {
      const school = SCHOOLS.find((s) => s[0] === Number(body.schoolId));
      if (!school) return NextResponse.json({ error: 'Pick a school from the list.' }, { status: 400 });
      const domain = normalizeDomainInput(typeof body.domain === 'string' ? body.domain : '');
      if (!domain.ok) return NextResponse.json({ error: domain.error }, { status: 400 });
      target = { schoolId: school[0], schoolName: school[1], schoolState: school[2] || null, domain: domain.domain };
    }
  }

  try {
    const db = getAdminSupabase();
    const summary = await runFeedDiscovery(createFeedDiscoveryRepo(db), httpPageFetcher, new Date(), { target });
    // First pull of the new feeds now, so students don't wait for the hourly
    // sync. Notifications are left to that sync (major events stay eligible
    // for 72 hours), which keeps this request short.
    let eventsImported = 0;
    for (const sourceId of summary.newSourceIds) {
      try {
        const r = await runCareerEventsSync(createCareerEventsRepo(db), httpFeedFetcher, new Date(), { sourceId, notify: false });
        eventsImported += r.sources.reduce((n, x) => n + x.count, 0);
      } catch (e) {
        console.error('First sync of discovered feed failed:', e);
      }
    }
    return NextResponse.json({ ...summary, eventsImported, via: auth.via }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Feed discovery failed:', e);
    return NextResponse.json(
      { error: 'Feed discovery failed. Make sure migrations/20261117_feed_discovery.sql has been applied.' },
      { status: 500 },
    );
  }
}

export const POST = handle;
// Vercel cron issues GET requests.
export const GET = handle;
