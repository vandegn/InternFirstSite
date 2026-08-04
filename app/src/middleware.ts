import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { DASHBOARD_ROUTES } from '@/lib/routes';

// Server-side gate on /dashboard/*. The client-side check in
// app/dashboard/layout.tsx still runs and still owns the in-app redirects
// (welcome screen, profile self-heal); this sits in front of it so a URL typed
// into the address bar is answered with a redirect before any protected page is
// rendered or shipped to the browser.
//
// Neither layer is the security boundary — RLS is. Someone who bypasses both
// and calls Supabase directly still gets nothing back. What this buys is that
// the markup and data-fetching code for a dashboard the caller has no business
// seeing never leaves the server.

export async function middleware(request: NextRequest) {
  // Every cookie Supabase refreshes has to ride back on the response we
  // actually return, or the session silently dies mid-navigation. Hence the
  // mutable `response` — see the @supabase/ssr middleware contract.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser, not getSession: this revalidates the JWT with the auth server
  // rather than trusting whatever the cookie claims.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    // So the user lands where they were headed once they're through.
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  // The role comes from the profiles table, never from user_metadata — a user
  // can write their own metadata, so authorizing on it would let anyone call
  // themselves an admin. This is one indexed lookup per dashboard navigation.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  // No profile row yet: let the request through and leave it to the layout,
  // which knows how to rebuild one from user_metadata before giving up.
  if (!profile?.role) return response;

  const allowedPath = DASHBOARD_ROUTES[profile.role];
  if (allowedPath && !pathname.startsWith(allowedPath)) {
    const home = request.nextUrl.clone();
    home.pathname = allowedPath;
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Scoped to the dashboard on purpose. A broader matcher would put an auth
  // round trip in front of the marketing pages and the login flow for no gain.
  matcher: ['/dashboard/:path*'],
};
