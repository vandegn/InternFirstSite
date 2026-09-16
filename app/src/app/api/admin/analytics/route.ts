import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
export async function GET(req: NextRequest) {
  const db = await getServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (profile?.role !== 'intern_first_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const start = req.nextUrl.searchParams.get('start') ?? '';
  const end = req.nextUrl.searchParams.get('end') ?? '';
  const role = req.nextUrl.searchParams.get('role') ?? 'all';
  const dates = [start, end].every(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
  if (!dates || start > end || (Date.parse(end) - Date.parse(start)) > 365 * 86400000 || !['all', 'student', 'employer', 'anonymous'].includes(role)) {
    return NextResponse.json({ error: 'Choose a valid date range of up to one year and role.' }, { status: 400 });
  }
  const { data, error } = await db.rpc('admin_product_analytics', { p_start: `${start}T00:00:00Z`, p_end: new Date(Date.parse(end) + 86400000).toISOString(), p_role: role });
  if (error) return NextResponse.json({ error: 'Analytics unavailable. Ensure the analytics migration has been applied.' }, { status: 503 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
