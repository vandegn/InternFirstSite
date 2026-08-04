import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-server';
import { createTeamRepo } from '@/lib/employer-team-repo';
import { getInviteInfo } from '@/lib/employer-team-service';

// Public: what the /join/[token] page shows before acceptance. Knowing the
// token *is* the authorization — it only ever travels in the invite email.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const { status, body } = await getInviteInfo(createTeamRepo(getAdminSupabase()), { token });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load invitation' },
      { status: 500 },
    );
  }
}
