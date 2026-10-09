import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resend, FROM_EMAIL } from '@/lib/resend';
import {
  interviewScheduledStudentEmail,
  interviewScheduledEmployerEmail,
} from '@/lib/email-templates';
import { validateInterviewFormat, interviewFormatColumns } from '@/lib/interview-format';
import { sendInterviewFormatMessage } from '@/lib/interview-format-message';
import { resolveRescheduleTarget, isUniqueViolation, LIVE_INTERVIEW_STATUSES } from '@/lib/interview-reschedule';

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

  const { scheduledAt, durationMinutes, notes, format, meetingUrl, timeZone } = await req.json();
  if (!scheduledAt || !durationMinutes) {
    return NextResponse.json({ error: 'scheduledAt and durationMinutes are required' }, { status: 400 });
  }
  // Callers that don't send a format leave the interview's current one alone.
  const formatCheck = format === undefined ? null : validateInterviewFormat({ format, meetingUrl });
  if (formatCheck && !formatCheck.ok) {
    return NextResponse.json({ error: formatCheck.error }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('interview_schedules')
    .select('id, application_id, status, employer_id, employer:employers!inner(user_id)')
    .eq('id', id)
    .single<{
      id: string;
      application_id: string;
      status: string;
      employer_id: string;
      employer: { user_id: string } | { user_id: string }[];
    }>();

  // The account owner, or any active teammate of the company.
  const employerOwner = existing && (Array.isArray(existing.employer) ? existing.employer[0] : existing.employer);
  let allowed = Boolean(existing && employerOwner?.user_id === user.id);
  if (existing && !allowed) {
    const { data: member } = await supabase
      .from('employer_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('employer_id', existing.employer_id)
      .eq('status', 'active')
      .maybeSingle();
    allowed = Boolean(member);
  }
  if (!existing || !allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Root cause of the duplicate-key failures: the row the client sent could be
  // a stale, closed one (declined / cancelled / completed) while the
  // application already had a different live interview — and forcing that row
  // back to 'pending' gave the application two live rows, which the unique
  // index interview_schedules_one_active_per_application rejects. Move the
  // application's live interview instead (a single, atomic UPDATE).
  const { data: liveRows } = await supabase
    .from('interview_schedules')
    .select('id')
    .eq('application_id', existing.application_id)
    .in('status', LIVE_INTERVIEW_STATUSES)
    .limit(1);
  const targetId = resolveRescheduleTarget(existing, liveRows?.[0] ?? null);

  const { data: updated, error } = await supabase
    .from('interview_schedules')
    .update({
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      employer_notes: notes ?? null,
      ...(formatCheck?.ok ? interviewFormatColumns(formatCheck.format, formatCheck.meetingUrl) : {}),
      status: 'pending',
      cancelled_by: null,
      cancelled_at: null,
    })
    .eq('id', targetId)
    .select()
    .single();

  if (isUniqueViolation(error)) {
    return NextResponse.json(
      { error: 'This candidate already has another active interview. Refresh the page and reschedule that one.' },
      { status: 409 },
    );
  }
  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update' }, { status: 500 });
  }

  if (formatCheck?.ok && formatCheck.format === 'internfirst') {
    // Switching back to the InternFirst room. Written separately and
    // best-effort so a database without the format columns still reschedules.
    await supabase
      .from('interview_schedules')
      .update({ format: 'internfirst', meeting_url: null })
      .eq('id', targetId)
      .neq('format', 'internfirst');
  } else if (formatCheck?.ok) {
    await sendInterviewFormatMessage(supabase, {
      senderUserId: user.id,
      interviewId: updated.id,
      timeZone,
      rescheduled: true,
    });
  }

  void sendRescheduleEmails(updated.id);

  return NextResponse.json(updated);
}

async function sendRescheduleEmails(interviewId: string) {
  if (!resend) return;

  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const { data } = await admin
    .from('interview_schedules')
    .select(`
      id, scheduled_at, duration_minutes,
      listing:internship_listings(title),
      student:students!inner(profile:profiles!inner(full_name, email)),
      employer:employers!inner(company_name, profile:profiles!inner(full_name, email))
    `)
    .eq('id', interviewId)
    .single();

  if (!data) return;

  const listing = Array.isArray(data.listing) ? data.listing[0] : data.listing;
  const student = Array.isArray(data.student) ? data.student[0] : data.student;
  const employer = Array.isArray(data.employer) ? data.employer[0] : data.employer;
  const studentProfile = student?.profile && (Array.isArray(student.profile) ? student.profile[0] : student.profile);
  const employerProfile = employer?.profile && (Array.isArray(employer.profile) ? employer.profile[0] : employer.profile);

  if (!listing || !studentProfile || !employerProfile) return;

  if (studentProfile.email) {
    const { subject, html } = interviewScheduledStudentEmail({
      employerName: employerProfile.full_name,
      companyName: employer.company_name,
      listingTitle: listing.title,
      scheduledAt: data.scheduled_at,
      durationMinutes: data.duration_minutes,
      interviewId: data.id,
    });
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: studentProfile.email,
      subject: `Updated: ${subject}`,
      html,
    });
    if (error) console.error('Resend (reschedule student) error:', error);
  }

  if (employerProfile.email) {
    const { subject, html } = interviewScheduledEmployerEmail({
      studentName: studentProfile.full_name,
      listingTitle: listing.title,
      scheduledAt: data.scheduled_at,
      durationMinutes: data.duration_minutes,
      interviewId: data.id,
    });
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: employerProfile.email,
      subject: `Updated: ${subject}`,
      html,
    });
    if (error) console.error('Resend (reschedule employer) error:', error);
  }
}
