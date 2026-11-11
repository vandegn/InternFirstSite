import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServerSupabase } from '@/lib/supabase-server';

// Shared gate for the content routes. Same two doors as the career-events
// sync: a scheduler holding CRON_SECRET (x-cron-secret header or a Bearer
// token), or a signed-in InternFirst admin.

function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ContentAuth =
  | { ok: true; via: 'cron' | 'admin'; userId: string | null }
  | { ok: false; res: NextResponse };

export async function authorizeContentRequest(req: NextRequest, opts: { allowCron: boolean } = { allowCron: true }): Promise<ContentAuth> {
  if (opts.allowCron) {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
    if (secretMatches(req.headers.get('x-cron-secret')) || secretMatches(bearer)) {
      return { ok: true, via: 'cron', userId: null };
    }
  }

  const db = await getServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile?.role !== 'intern_first_admin') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, via: 'admin', userId: user.id };
}
