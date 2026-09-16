import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getServerSupabase } from '@/lib/supabase-server';
import { parseEvent } from '@/lib/product-analytics';

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.text();
  if (body.length > 2048) return NextResponse.json({ error: 'Too large' }, { status: 413 });
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return NextResponse.json({ error: 'Invalid event' }, { status: 400 }); }
  const event = parseEvent(raw);
  if (!event) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  const session = await getServerSupabase();
  const { data: { user } } = await session.auth.getUser();
  const { data: profile } = user ? await session.from('profiles').select('role').eq('user_id', user.id).maybeSingle() : { data: null };
  if (profile?.role === 'intern_first_admin') return NextResponse.json({ ok: true });
  if ((event.name === 'application_started' && profile?.role !== 'student') ||
      (event.name === 'job_posting_started' && profile?.role !== 'employer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Verify the listing is actually visible to this visitor under existing RLS.
  if (event.listingId) {
    const { data } = await session.from('internship_listings').select('id').eq('id', event.listingId).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Listing unavailable' }, { status: 404 });
  }
  const admin = getAdminSupabase();
  const role = event.name === 'registration_started' ? event.role : profile?.role ?? 'anonymous';
  const flowKey = event.name === 'application_started' ? `${user!.id}:${event.listingId}`
    : event.name === 'listing_viewed' ? `${event.sessionId}:${event.listingId}`
    : event.name === 'registration_started' ? `${event.flowId}:${role}`
    : event.name === 'job_posting_started' ? event.flowId! : event.id;
  const { data, error } = await admin.rpc('record_product_event', {
    p_id: event.id, p_name: event.name, p_role: role, p_session: event.sessionId,
    p_flow: flowKey, p_path: event.path, p_cta: event.cta, p_listing: event.listingId,
  });
  if (error) {
    console.error('[analytics] Event storage unavailable:', error.code);
    return NextResponse.json({ error: 'Tracking unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: data }, { status: data ? 200 : 429 });
}
