import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { createAvailabilityRepo } from '@/lib/interview-availability-repo';
import { submitAvailability } from '@/lib/interview-availability-service';

// Step 2 — the student submits the frames that work (or reports that none do).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slots, note, timezone, noneWork } = await req.json();

  try {
    const { status, body } = await submitAvailability(createAvailabilityRepo(supabase), {
      userId: user.id,
      requestId: id,
      slots: Array.isArray(slots) ? slots : [],
      note,
      timezone,
      noneWork: Boolean(noneWork),
    });
    return NextResponse.json(body, { status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to submit availability' },
      { status: 500 },
    );
  }
}
