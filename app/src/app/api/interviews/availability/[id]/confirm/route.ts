import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { createAvailabilityRepo } from '@/lib/interview-availability-repo';
import { confirmInterviewTime } from '@/lib/interview-availability-service';
import { isMeetingType } from '@/lib/interview-availability';

// Step 3 — the employer confirms the time the student selected.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { notes, format, meetingUrl, timeZone, meetingType } = await req.json();

  try {
    const { status, body } = await confirmInterviewTime(createAvailabilityRepo(supabase), {
      userId: user.id,
      requestId: id,
      notes,
      format,
      meetingUrl,
      timeZone,
      meetingType: isMeetingType(meetingType) ? meetingType : undefined,
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to confirm the meeting' },
      { status: 500 },
    );
  }
}
