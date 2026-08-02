import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';

// Account deletion is a soft delete with a six-month retention window.
//
// Immediately: the profile is stamped deleted_at (a DB trigger closes any
// employer listings), and the auth user is banned so login and token refresh
// both fail. Their rows stay put — see
// migrations/20260801_account_deletion.sql for the pg_cron job that does the
// irreversible purge once purge_after passes.
//
// The ban duration is deliberately longer than the retention window: if the
// purge job is ever paused, the account still must not come back to life.
const RETENTION_MONTHS = 6;
const BAN_DURATION = '87600h'; // 10 years

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { confirmation, reason }: { confirmation?: string; reason?: string } =
    await req.json().catch(() => ({}));

  // The client makes the user type this; re-check it here so the endpoint
  // can't be hit accidentally by anything holding a session cookie.
  if (confirmation !== 'DELETE') {
    return NextResponse.json(
      { error: 'Type DELETE to confirm account deletion.' },
      { status: 400 },
    );
  }

  const admin = adminClient();
  if (!admin) {
    console.error('[account/delete] SUPABASE_SERVICE_ROLE_KEY is not configured');
    return NextResponse.json(
      { error: 'Account deletion is unavailable right now. Please contact support.' },
      { status: 500 },
    );
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role, email, deleted_at')
    .eq('user_id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.deleted_at) {
    return NextResponse.json({ error: 'This account is already scheduled for deletion.' }, { status: 409 });
  }

  const purgeAfter = new Date();
  purgeAfter.setMonth(purgeAfter.getMonth() + RETENTION_MONTHS);

  const { error: requestError } = await admin
    .from('account_deletion_requests')
    .upsert(
      {
        user_id: user.id,
        role: profile.role,
        email: profile.email,
        reason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 1000) : null,
        requested_at: new Date().toISOString(),
        purge_after: purgeAfter.toISOString(),
        status: 'pending_purge',
      },
      { onConflict: 'user_id' },
    );

  if (requestError) {
    console.error('[account/delete] failed to record request', requestError.message);
    return NextResponse.json({ error: 'Could not record the deletion request.' }, { status: 500 });
  }

  // Stamping deleted_at fires trg_close_listings_on_deletion, which closes any
  // active employer listings so the account stops accruing applicants.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (profileError) {
    console.error('[account/delete] failed to mark profile deleted', profileError.message);
    return NextResponse.json({ error: 'Could not complete the deletion.' }, { status: 500 });
  }

  // Lock the account out. Done last: if this fails, the record and the
  // deleted_at stamp already exist, so the request isn't silently lost.
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, {
    ban_duration: BAN_DURATION,
  });
  if (banError) {
    console.error('[account/delete] failed to ban auth user', banError.message);
  }

  return NextResponse.json({
    ok: true,
    purgeAfter: purgeAfter.toISOString(),
    retentionMonths: RETENTION_MONTHS,
  });
}
