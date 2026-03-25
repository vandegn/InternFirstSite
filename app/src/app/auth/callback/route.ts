import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createProfileAndRoleData, DASHBOARD_ROUTES } from '@/lib/supabase';

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

  const metadata = user.user_metadata;
  const role = metadata?.role as string;

  if (!role) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Idempotency check: skip profile creation if it already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!existingProfile) {
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

  return NextResponse.redirect(`${origin}${DASHBOARD_ROUTES[role] || '/dashboard/student'}`);
}
