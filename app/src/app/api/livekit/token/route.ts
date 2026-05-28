import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateLiveKitToken, getLiveKitRoomName } from '@/lib/livekit';

export async function GET(req: NextRequest) {
  const interviewId = req.nextUrl.searchParams.get('interviewId');
  if (!interviewId) return NextResponse.json({ error: 'Missing interviewId' }, { status: 400 });

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
      student:students!inner(user_id, profile:profiles!inner(full_name)),
      employer:employers!inner(user_id, profile:profiles!inner(full_name))
    `)
    .eq('id', interviewId)
    .single();

  if (fetchError || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (interview.status !== 'accepted') {
    return NextResponse.json({ error: 'Interview is not confirmed' }, { status: 409 });
  }

  const student = Array.isArray(interview.student) ? interview.student[0] : interview.student;
  const employer = Array.isArray(interview.employer) ? interview.employer[0] : interview.employer;

  const isStudent = student?.user_id === user.id;
  const isEmployer = employer?.user_id === user.id;

  if (!isStudent && !isEmployer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const start = new Date(interview.scheduled_at).getTime();
  const end = start + (interview.duration_minutes + 30) * 60 * 1000;
  const earliest = start - 10 * 60 * 1000;
  const now = Date.now();

  if (now < earliest) {
    return NextResponse.json({
      error: 'outside_window',
      message: `Joinable at ${new Date(earliest).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    }, { status: 400 });
  }

  if (now > end) {
    return NextResponse.json({ error: 'outside_window', message: 'This interview has ended' }, { status: 400 });
  }

  const studentProfile = Array.isArray(student?.profile) ? student.profile[0] : student?.profile;
  const employerProfile = Array.isArray(employer?.profile) ? employer.profile[0] : employer?.profile;
  const userName = isEmployer
    ? (employerProfile?.full_name ?? 'Employer')
    : (studentProfile?.full_name ?? 'Student');

  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!url) {
    return NextResponse.json({ error: 'LiveKit URL is not configured on this server' }, { status: 503 });
  }

  let token: string;
  try {
    token = await generateLiveKitToken({
      interviewId,
      userId: user.id,
      userName,
      isHost: isEmployer,
    });
  } catch {
    return NextResponse.json({ error: 'LiveKit is not configured on this server' }, { status: 503 });
  }

  return NextResponse.json({
    token,
    url,
    roomName: getLiveKitRoomName(interviewId),
    identity: `user-${user.id}`,
    userName,
    isHost: isEmployer,
  });
}
