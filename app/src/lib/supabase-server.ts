import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Request-scoped client that reads the logged-in user from cookies (RLS applies).
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
}

// Anonymous, cookie-less client: sees exactly what a logged-out visitor sees,
// because the anon RLS policies are the only thing granting it anything. Used
// by sitemap.ts so a URL can never be advertised to crawlers unless the public
// can actually load it. Returns null when env is unset (e.g. a build with no
// Supabase credentials) so callers can degrade instead of throwing.
export function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createServerClient(url, anonKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

// Privileged client that bypasses RLS — use only in trusted server code
// (Stripe webhook, invoicing). Falls back to the anon key if unset.
export function getAdminSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
