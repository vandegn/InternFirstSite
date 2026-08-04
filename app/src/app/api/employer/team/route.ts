import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { createTeamRepo } from '@/lib/employer-team-repo';
import { listTeam, inviteMember } from '@/lib/employer-team-service';

// The roster. Master admins get invite tokens (for copyable join links);
// everyone else gets the sanitised list.
export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { status, body } = await listTeam(createTeamRepo(getAdminSupabase()), { userId: user.id });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load team' },
      { status: 500 },
    );
  }
}

// Invite a teammate (Master Admin only).
export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, name, role } = await req.json();

  try {
    const { status, body } = await inviteMember(createTeamRepo(getAdminSupabase()), {
      userId: user.id,
      email: String(email ?? ''),
      name: typeof name === 'string' ? name : undefined,
      role: String(role ?? ''),
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to send invitation' },
      { status: 500 },
    );
  }
}
