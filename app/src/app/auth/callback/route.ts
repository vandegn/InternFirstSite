import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { completeVerifiedSignIn } from '@/lib/auth-post-verification';

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

  const result = await completeVerifiedSignIn(supabase);

  if ('error' in result) {
    const suffix = result.error === 'missing_role' ? '' : `?error=${result.error}`;
    return NextResponse.redirect(`${origin}/login${suffix}`);
  }

  return NextResponse.redirect(`${origin}${result.redirectTo}`);
}
