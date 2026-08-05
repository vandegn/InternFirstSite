import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { completeVerifiedSignIn } from '@/lib/auth-post-verification';

// Verifies the token_hash from the email template's
// `/auth/confirm?token_hash={{ .TokenHash }}&type=email` link. POST-only and
// fired by the interstitial page's button, never on page load, so mail
// scanners that prefetch GETs can't burn the single-use token.
const ALLOWED_TYPES = ['email', 'signup'] as const;
type ConfirmType = (typeof ALLOWED_TYPES)[number];

export async function POST(request: Request) {
  let body: { token_hash?: string; type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const tokenHash = body.token_hash;
  const type = body.type as ConfirmType;

  if (!tokenHash || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
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

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    // Expired and already-used tokens both surface here; the page tells the
    // user to request a fresh link rather than exposing Supabase's message.
    console.error('Token verification failed:', error);
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  const result = await completeVerifiedSignIn(supabase);

  if ('error' in result) {
    // Verified but couldn't finish setup — send them to login, where the
    // self-healing in ensureProfileFromMetadata gets another chance.
    return NextResponse.json({ redirectTo: '/login' });
  }

  return NextResponse.json({ redirectTo: result.redirectTo });
}
