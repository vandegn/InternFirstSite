import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { deleteZoomMeeting } from '@/lib/zoom';

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

  const { data: interview, error: fetchError } = await supabase
    .from('interview_schedules')
    .select(`
      *,
      student:students!inner(user_id),
      employer:employers!inner(user_id)
    `)
    .eq('id', id)
    .single();

  if (fetchError || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  const student = Array.isArray(interview.student) ? interview.student[0] : interview.student;
  const employer = Array.isArray(interview.employer) ? interview.employer[0] : interview.employer;

  const isStudent = student?.user_id === user.id;
  const isEmployer = employer?.user_id === user.id;

  if (!isStudent && !isEmployer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (['cancelled', 'completed', 'declined'].includes(interview.status)) {
    return NextResponse.json({ error: 'Interview cannot be cancelled in its current state' }, { status: 409 });
  }

  // Clean up the Zoom meeting if one was created
  if (interview.zoom_meeting_id) {
    try {
      await deleteZoomMeeting(interview.zoom_meeting_id);
    } catch {
      // Best-effort — proceed even if deletion fails
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('interview_schedules')
    .update({
      status: 'cancelled',
      cancelled_by: isEmployer ? 'employer' : 'student',
      cancelled_at: new Date().toISOString(),
      zoom_meeting_id: null,
      zoom_meeting_password: null,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(updated);
}
