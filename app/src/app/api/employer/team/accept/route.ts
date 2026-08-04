import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { createTeamRepo } from '@/lib/employer-team-repo';
import { acceptInvite } from '@/lib/employer-team-service';

// Accept an invitation. Signed-in users accept with their session; new users
// send fullName + password and get an account created as part of accepting
// (the join page then signs them in with those credentials).
export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { token, fullName, password } = await req.json();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
  }

  try {
    const { status, body } = await acceptInvite(createTeamRepo(getAdminSupabase()), {
      token,
      userId: user?.id,
      fullName: typeof fullName === 'string' ? fullName : undefined,
      password: typeof password === 'string' ? password : undefined,
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to accept invitation' },
      { status: 500 },
    );
  }
}
