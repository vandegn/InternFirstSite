import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { generateLiveKitToken, getLiveKitRoomName } from '@/lib/livekit';

// Mints the LiveKit token for one confirmed interview. The caller must be the
// interview's student or an active member of the hiring company (any
// teammate, not only the account that registered it), and the request must
// land inside the join window: 10 minutes before the start until 30 minutes
// after the meeting's scheduled end.
//
// The interview row is read on its own, with no embedded joins: employers has
// two foreign keys into profiles (user_id and reviewed_by), so an embedded
// `profiles` join is ambiguous and PostgREST refuses the whole request — which
// is what used to surface as "Interview not found" on both sides.
export async function GET(req: NextRequest) {
  const interviewId = req.nextUrl.searchParams.get('interviewId');
  if (!interviewId) return NextResponse.json({ error: 'Missing interviewId' }, { status: 400 });

  const supabase = await getServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // RLS already limits this to the student and the company's active members.
  const { data: interview, error: fetchError } = await supabase
    .from('interview_schedules')
    .select('id, student_id, employer_id, status, scheduled_at, duration_minutes')
    .eq('id', interviewId)
    .maybeSingle();

  if (fetchError || !interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (interview.status !== 'accepted') {
    return NextResponse.json({ error: 'Interview is not confirmed' }, { status: 409 });
  }

  const [studentRes, memberRes, ownerRes, profileRes] = await Promise.all([
    supabase
      .from('students')
      .select('id')
      .eq('id', interview.student_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('employer_members')
      .select('id')
      .eq('employer_id', interview.employer_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    // Original account owner — covers a database the team migration hasn't
    // reached, where employer_members is empty.
    supabase
      .from('employers')
      .select('id')
      .eq('id', interview.employer_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const isStudent = Boolean(studentRes.data);
  const isEmployer = !isStudent && Boolean(memberRes.data || ownerRes.data);

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

  const userName = profileRes.data?.full_name ?? (isEmployer ? 'Employer' : 'Student');

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
