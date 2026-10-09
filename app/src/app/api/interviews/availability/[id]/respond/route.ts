import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { createAvailabilityRepo } from '@/lib/interview-availability-repo';
import { selectInterviewSlot } from '@/lib/interview-availability-service';

// Step 2 — the student picks one of the offered slots (or says none work).
// The pick is tentative until the employer confirms it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slotId, note, timezone, noneWork } = await req.json();

  try {
    const { status, body } = await selectInterviewSlot(createAvailabilityRepo(supabase), {
      userId: user.id,
      requestId: id,
      slotId: typeof slotId === 'string' ? slotId : null,
      note,
      timezone,
      noneWork: Boolean(noneWork),
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save your pick' },
      { status: 500 },
    );
  }
}
