import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createProfileAndRoleData, DASHBOARD_ROUTES } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Collect cookies with their full options so we can forward them to the redirect
  const cookiesToForward: { name: string; value: string; options?: any }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookiesToForward.push(cookie);
        }
      },
    },
  });

  // Exchange the code for a session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  // Get the authenticated user and their metadata
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  const metadata = user.user_metadata;
  const role = metadata?.role as string;

  if (!role) {
    // No metadata — might be a Google OAuth user or something unexpected
    return NextResponse.redirect(`${origin}/login`);
  }

  // Idempotency check: skip profile creation if it already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!existingProfile) {
    // Build roleData from metadata
    const roleData: Record<string, string | undefined> = {};

    if (role === 'student') {
      roleData.major = metadata.major;
      roleData.graduationYear = metadata.graduationYear;
    } else if (role === 'employer') {
      roleData.companyName = metadata.companyName;
      roleData.website = metadata.website;
      roleData.companyDescription = metadata.companyDescription;
    } else if (role === 'university_admin') {
      roleData.universityId = metadata.universityId;
      roleData.jobTitle = metadata.jobTitle;
    }

    try {
      await createProfileAndRoleData(supabase, user.id, {
        role,
        fullName: metadata.fullName || '',
        email: user.email || '',
        phone: metadata.phone,
        roleData,
      });
    } catch (err) {
      console.error('Profile creation failed:', err);
      return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
    }
  }

  // Redirect to the role-appropriate dashboard, forwarding session cookies with full options
  const dashboardPath = DASHBOARD_ROUTES[role] || '/dashboard/student';
  const redirectResponse = NextResponse.redirect(new URL(dashboardPath, origin));
  for (const { name, value, options } of cookiesToForward) {
    redirectResponse.cookies.set(name, value, options);
  }

  return redirectResponse;
}
