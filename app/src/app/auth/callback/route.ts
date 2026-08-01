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
