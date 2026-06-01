import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { resend, FROM_EMAIL } from '@/lib/resend';
import { interviewReminderEmail } from '@/lib/email-templates';

type ProfileRow = { full_name: string; email: string };
type StudentRow = { profile: ProfileRow | ProfileRow[] };
type EmployerRow = { company_name: string; profile: ProfileRow | ProfileRow[] };
type ListingRow = { title: string };
type InterviewRow = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  listing: ListingRow | ListingRow[];
  student: StudentRow | StudentRow[];
  employer: EmployerRow | EmployerRow[];
};

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!resend) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const now = new Date();
  const cutoff = new Date(now.getTime() + 30 * 60_000).toISOString();
  const nowIso = now.toISOString();

  const { data: due, error } = await admin
    .from('interview_schedules')
    .select(`
      id, scheduled_at, duration_minutes,
      listing:internship_listings(title),
      student:students!inner(profile:profiles!inner(full_name, email)),
      employer:employers!inner(company_name, profile:profiles!inner(full_name, email))
    `)
    .eq('status', 'accepted')
    .is('reminder_sent_at', null)
    .gt('scheduled_at', nowIso)
    .lte('scheduled_at', cutoff);

  if (error) {
    console.error('Cron query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; sent: boolean; reason?: string }> = [];

  for (const row of (due ?? []) as InterviewRow[]) {
    const listing = pickOne(row.listing);
    const student = pickOne(row.student);
    const employer = pickOne(row.employer);
    const studentProfile = student ? pickOne(student.profile) : null;
    const employerProfile = employer ? pickOne(employer.profile) : null;

    if (!listing || !student || !employer || !studentProfile || !employerProfile) {
      results.push({ id: row.id, sent: false, reason: 'missing relations' });
      continue;
    }

    if (studentProfile.email) {
      const { subject, html } = interviewReminderEmail({
        recipientRole: 'student',
        otherPartyName: employer.company_name,
        listingTitle: listing.title,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes,
        interviewId: row.id,
      });
      const { error: e } = await resend.emails.send({
        from: FROM_EMAIL,
        to: studentProfile.email,
        subject,
        html,
      });
      if (e) console.error('Resend (reminder student) error:', e);
    }

    if (employerProfile.email) {
      const { subject, html } = interviewReminderEmail({
        recipientRole: 'employer',
        otherPartyName: studentProfile.full_name,
        listingTitle: listing.title,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes,
        interviewId: row.id,
      });
      const { error: e } = await resend.emails.send({
        from: FROM_EMAIL,
        to: employerProfile.email,
        subject,
        html,
      });
      if (e) console.error('Resend (reminder employer) error:', e);
    }

    await admin
      .from('interview_schedules')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', row.id);

    results.push({ id: row.id, sent: true });
  }

  return NextResponse.json({ processed: results.length, results });
}
