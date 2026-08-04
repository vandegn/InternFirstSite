import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { createTeamRepo } from '@/lib/employer-team-repo';
import { changeMemberRole, setMemberActive, revokeInvite } from '@/lib/employer-team-service';

// Change a member's role, or (de)activate them (Master Admin only).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { role, active } = await req.json();

  try {
    const repo = createTeamRepo(getAdminSupabase());
    if (typeof role === 'string') {
      const { status, body } = await changeMemberRole(repo, { userId: user.id, memberId: id, role });
      return NextResponse.json(body, { status });
    }
    if (typeof active === 'boolean') {
      const { status, body } = await setMemberActive(repo, { userId: user.id, memberId: id, active });
      return NextResponse.json(body, { status });
    }
    return NextResponse.json({ error: 'Provide a role or an active flag' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update team member' },
      { status: 500 },
    );
  }
}

// Revoke a pending invitation (Master Admin only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { status, body } = await revokeInvite(createTeamRepo(getAdminSupabase()), {
      userId: user.id,
      memberId: id,
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to revoke invitation' },
      { status: 500 },
    );
  }
}
