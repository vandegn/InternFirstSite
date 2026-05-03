import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

  if (student?.user_id !== user.id && employer?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Only mark completed if the scheduled time has passed
  const scheduledTime = new Date(interview.scheduled_at).getTime();
  if (Date.now() < scheduledTime) {
    return NextResponse.json({ status: interview.status });
  }

  if (interview.status !== 'accepted') {
    return NextResponse.json({ status: interview.status });
  }

  const { data: updated, error: updateError } = await supabase
    .from('interview_schedules')
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(updated);
}
