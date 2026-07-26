import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureProfileFromMetadata, DASHBOARD_ROUTES } from '@/lib/supabase';

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

  return NextResponse.redirect(`${origin}${DASHBOARD_ROUTES[role] || '/dashboard/student'}`);
}
