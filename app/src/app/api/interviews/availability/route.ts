import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { createAvailabilityRepo } from '@/lib/interview-availability-repo';
import { requestAvailability } from '@/lib/interview-availability-service';

// Step 1 — the employer proposes concrete time slots to the candidate.
export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { applicationId, windowStart, windowEnd, durationMinutes, slots, timeZone, note, today } = await req.json();

  try {
    const { status, body } = await requestAvailability(createAvailabilityRepo(supabase), {
      userId: user.id,
      applicationId,
      windowStart,
      windowEnd,
      durationMinutes,
      slots: Array.isArray(slots) ? slots : [],
      timeZone: typeof timeZone === 'string' ? timeZone : undefined,
      note,
      // The employer's local calendar day, so "can't start in the past" is
      // judged in their zone rather than the server's.
      today,
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to request a time' },
      { status: 500 },
    );
  }
}
