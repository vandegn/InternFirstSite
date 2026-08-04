import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureProfileFromMetadata, DASHBOARD_ROUTES } from '@/lib/supabase';
import { getAdminSupabase } from '@/lib/supabase-server';
import { computeVerificationSignals } from '@/lib/domain-signals';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Code exchange failed:', error);
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  const role = user.user_metadata?.role as string;

  if (!role) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    // Idempotent: skips creation if the profile already exists
    await ensureProfileFromMetadata(supabase, user);
  } catch (err) {
    console.error('Profile creation failed:', err);
    return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
  }

  // Durable record of the signup-time Terms/Privacy acknowledgement. The
  // register page stamps the accepted versions into user_metadata; accepted_at
  // is the client's claim, recorded_at (DB default) is server time. Unique on
  // (user, role, versions) so re-visiting the callback link is a no-op.
  // Non-fatal: a logging gap must never cost someone their signup.
  const meta = user.user_metadata ?? {};
  if ((role === 'student' || role === 'employer') && meta.termsVersion && meta.privacyVersion) {
    try {
      await getAdminSupabase().from('policy_acceptances').upsert(
        {
          user_id: user.id,
          role,
          terms_version: String(meta.termsVersion),
          privacy_version: String(meta.privacyVersion),
          accepted_at: meta.policyAcceptedAt ?? new Date().toISOString(),
        },
        { onConflict: 'user_id,role,terms_version,privacy_version', ignoreDuplicates: true },
      );
    } catch (err) {
      console.error('Policy acceptance recording failed:', err);
    }
  }

  // Seed the verification signals so the employer lands in the review queue
  // already triaged. Deliberately non-fatal and time-boxed by the RDAP
  // timeout — a slow registry must never cost someone their signup.
  if (role === 'employer') {
    try {
      const admin = getAdminSupabase();
      const { data: employer } = await admin
        .from('employers')
        .select('id, website')
        .eq('user_id', user.id)
        .single();

      if (employer) {
        const signals = await computeVerificationSignals(user.email, employer.website);
        await admin.from('employers').update(signals).eq('id', employer.id);
      }
    } catch (err) {
      console.error('Verification signal check failed:', err);
    }
  }

  return NextResponse.redirect(`${origin}${DASHBOARD_ROUTES[role] || '/dashboard/student'}`);
}
