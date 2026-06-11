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
      student:students!inner(user_id)
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

  const { data: updated, error: updateError } = await supabase
    .from('interview_schedules')
    .update({ status: 'accepted' })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(updated);
}
