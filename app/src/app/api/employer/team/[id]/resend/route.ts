import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { createTeamRepo } from '@/lib/employer-team-repo';
import { resendInvite } from '@/lib/employer-team-service';

// Resend a pending invitation — same token, fresh 7-day clock (Master Admin only).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { status, body } = await resendInvite(createTeamRepo(getAdminSupabase()), {
      userId: user.id,
      memberId: id,
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to resend invitation' },
      { status: 500 },
    );
  }
}
