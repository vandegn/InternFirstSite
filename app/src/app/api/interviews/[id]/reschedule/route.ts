import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resend, FROM_EMAIL } from '@/lib/resend';
import {
  interviewScheduledStudentEmail,
  interviewScheduledEmployerEmail,
} from '@/lib/email-templates';

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

  const { scheduledAt, durationMinutes, notes } = await req.json();
  if (!scheduledAt || !durationMinutes) {
    return NextResponse.json({ error: 'scheduledAt and durationMinutes are required' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('interview_schedules')
    .select('id, employer:employers!inner(user_id)')
    .eq('id', id)
    .single<{ id: string; employer: { user_id: string } | { user_id: string }[] }>();

  const employerOwner = existing && (Array.isArray(existing.employer) ? existing.employer[0] : existing.employer);
  if (!existing || employerOwner?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: updated, error } = await supabase
    .from('interview_schedules')
    .update({
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      employer_notes: notes ?? null,
      status: 'pending',
      reminder_sent_at: null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update' }, { status: 500 });
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
