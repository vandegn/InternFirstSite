import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { computeVerificationSignals } from '@/lib/domain-signals';

// Computes the automated verification signals for an employer and stores them
// on the row. Called once from /auth/callback right after signup, and again
// on demand from the admin review queue ("Re-run checks").
//
// Written with the service-role client on purpose: employers can update their
// own row, and signals they could forge would be worthless to a reviewer.
//
// Auth: the employer themselves (own row only), or an intern_first_admin
// passing { employerId } to re-run someone else's.
export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedId: string | undefined = body?.employerId;

  const admin = getAdminSupabase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  const isAdmin = profile?.role === 'intern_first_admin';

  if (requestedId && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve the target employer plus the email that account signed up with.
  const query = admin
    .from('employers')
    .select('id, user_id, website, profile:profiles!employers_user_id_fkey(email)');

  const { data, error: loadError } = requestedId
    ? await query.eq('id', requestedId).single()
    : await query.eq('user_id', user.id).single();

  if (loadError || !data) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
  }

  // Supabase types the embedded join as an array; it is 1:1 here.
  const employer = data as unknown as {
    id: string;
    website: string | null;
    profile: { email: string } | { email: string }[] | null;
  };
  const joined = Array.isArray(employer.profile) ? employer.profile[0] : employer.profile;
  const email = joined?.email ?? user.email ?? null;
  const signals = await computeVerificationSignals(email, employer.website);

  const { error: writeError } = await admin
    .from('employers')
    .update(signals)
    .eq('id', employer.id);

  if (writeError) {
    console.error('[verification-signals] write failed:', writeError.message);
    return NextResponse.json({ error: 'Could not store signals' }, { status: 500 });
  }

  return NextResponse.json({ signals });
}
