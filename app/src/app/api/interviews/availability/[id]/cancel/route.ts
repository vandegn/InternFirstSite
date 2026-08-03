import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { createAvailabilityRepo } from '@/lib/interview-availability-repo';
import { cancelAvailabilityRequest } from '@/lib/interview-availability-service';

// Off-ramp — the employer withdraws the request, freeing them to ask for a
// different window when none of the offered slots work.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reason } = await req.json().catch(() => ({ reason: undefined }));

  try {
    const { status, body } = await cancelAvailabilityRequest(createAvailabilityRepo(supabase), {
      userId: user.id,
      requestId: id,
      reason,
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to withdraw the interview request' },
      { status: 500 },
    );
  }
}
