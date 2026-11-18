import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServerSupabase } from '@/lib/supabase-server';

// Auth for server jobs that run two ways: on a schedule (pg_cron sends
// x-cron-secret; a Vercel cron sends Authorization: Bearer — both must equal
// CRON_SECRET) or from an admin's button (their session, role
// intern_first_admin). Used by /api/career-events/sync and /discover.

function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authorizeCronOrAdmin(
  req: NextRequest,
): Promise<{ ok: true; via: 'cron' | 'admin' } | { ok: false; res: NextResponse }> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (secretMatches(req.headers.get('x-cron-secret')) || secretMatches(bearer)) return { ok: true, via: 'cron' };

  const db = await getServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile?.role !== 'intern_first_admin') return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ok: true, via: 'admin' };
}
