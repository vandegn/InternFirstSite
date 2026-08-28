import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { DASHBOARD_ROUTES } from '@/lib/routes';

// Two jobs, both auth-shaped:
//
//   /dashboard/*  — server-side gate, described below.
//   /             — send an already-logged-in visitor to their dashboard.
//
// The homepage used to do that second one itself, in a useEffect, which meant
// every visitor (crawlers included) was served "Loading..." while the browser
// resolved a session. Doing it here instead means the marketing page is static
// HTML for anyone without a session cookie, and logged-in users get a 302
// before any HTML is sent — no flash either way.
//
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

// Supabase stores its session in `sb-<project-ref>-auth-token`, sometimes split
// across `.0`/`.1` chunks when the JWT is large. We only need to know whether
// ANY of them exist, so a prefix match is enough — and it's the whole point of
// this function: an anonymous visitor or a crawler hitting '/' must not pay for
// an auth round trip just so we can discover they're anonymous.
function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes('auth-token'));
}

export async function middleware(request: NextRequest) {
  const isHome = request.nextUrl.pathname === '/';

  // Fast path: no session cookie on the homepage means there is nothing to
  // redirect, so hand back the static page without touching Supabase. This is
  // the common case for ad traffic and every crawler.
  if (isHome && !hasSupabaseSessionCookie(request)) {
    return NextResponse.next();
  }

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
    // A stale or expired cookie on the homepage — not a reason to bounce a
    // visitor to /login. Serve the marketing page.
    if (isHome) return response;

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
  // which knows how to rebuild one from user_metadata before giving up. On the
  // homepage that just means they stay on the marketing page, which is right —
  // we have nowhere specific to send them.
  if (!profile?.role) return response;

  const allowedPath = DASHBOARD_ROUTES[profile.role];

  // Logged in and looking at the homepage: straight to their dashboard. This
  // replaces the redirect the page component used to do after mount.
  if (isHome) {
    if (!allowedPath) return response;
    const home = request.nextUrl.clone();
    home.pathname = allowedPath;
    home.search = '';
    return NextResponse.redirect(home);
  }

  if (allowedPath && !pathname.startsWith(allowedPath)) {
    const home = request.nextUrl.clone();
    home.pathname = allowedPath;
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // The dashboard, plus the homepage. Still deliberately narrow: every other
  // marketing page and the whole login flow stay off this path, and '/' bails
  // out on a cookie check before any auth round trip, so the only requests that
  // actually call Supabase here are ones that already carry a session.
  matcher: ['/dashboard/:path*', '/'],
};
