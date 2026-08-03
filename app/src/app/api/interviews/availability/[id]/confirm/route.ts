import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { createAvailabilityRepo } from '@/lib/interview-availability-repo';
import { confirmInterviewTime } from '@/lib/interview-availability-service';

// Step 3 — the employer picks the final time out of what the student offered.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scheduledAt, durationMinutes, notes } = await req.json();

  try {
    const { status, body } = await confirmInterviewTime(createAvailabilityRepo(supabase), {
      userId: user.id,
      requestId: id,
      scheduledAt,
      durationMinutes,
      notes,
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to schedule the interview' },
      { status: 500 },
    );
  }
}
