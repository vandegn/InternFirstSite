import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createZoomMeeting } from '@/lib/zoom';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch the interview with enough data to validate and create the Zoom meeting
  const { data: interview, error: fetchError } = await supabase
    .from('interview_schedules')
    .select(`
      *,
      student:students!inner(user_id),
      listing:internship_listings(title),
      employer:employers(company_name)
    `)
    .eq('id', id)
    .single();

  if (fetchError || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  const student = Array.isArray(interview.student) ? interview.student[0] : interview.student;
  if (student?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (interview.status !== 'pending') {
    return NextResponse.json({ error: 'Interview is not in pending state' }, { status: 409 });
  }

  // Create the Zoom meeting server-side
  let zoomMeetingId: string | null = null;
  let zoomPassword: string | null = null;

  try {
    const listing = Array.isArray(interview.listing) ? interview.listing[0] : interview.listing;
    const employer = Array.isArray(interview.employer) ? interview.employer[0] : interview.employer;
    const topic = `${employer?.company_name ?? 'InternFirst'} — ${listing?.title ?? 'Interview'}`;
    const zoom = await createZoomMeeting({
      topic,
      startTime: interview.scheduled_at,
      durationMinutes: interview.duration_minutes,
    });
    zoomMeetingId = zoom.meetingId;
    zoomPassword = zoom.password;
  } catch {
    // Zoom not configured or API error — proceed without video for now
  }

  const { data: updated, error: updateError } = await supabase
    .from('interview_schedules')
    .update({
      status: 'accepted',
      ...(zoomMeetingId ? { zoom_meeting_id: zoomMeetingId, zoom_meeting_password: zoomPassword } : {}),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(updated);
}
