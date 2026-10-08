import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminSupabase } from '@/lib/supabase-server';
import { buildInterviewFormatMessage, interviewFormatOf } from '@/lib/interview-format';

function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/**
 * Sends the student a chat message for an off-platform interview: the date,
 * time and link for "your own link", or the request for a phone number for a
 * phone screen. No-op for the InternFirst room.
 *
 * The message is inserted with the employer's own session (messages RLS
 * requires sender_id = auth.uid()); the interview context is read with the
 * service role because the student's user_id isn't always visible to every
 * team member through RLS. Best-effort: a failed message never undoes the
 * interview that was just scheduled.
 */
export async function sendInterviewFormatMessage(
  supabase: SupabaseClient,
  opts: { senderUserId: string; interviewId: string; timeZone?: string; rescheduled?: boolean },
): Promise<void> {
  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('interview_schedules')
      .select(`
        id, application_id, scheduled_at, duration_minutes, employer_notes, format, meeting_url,
        listing:internship_listings(title),
        student:students(user_id),
        employer:employers(company_name)
      `)
      .eq('id', opts.interviewId)
      .single();
    if (!data) return;

    const format = interviewFormatOf(data);
    const student = one(data.student as { user_id: string } | { user_id: string }[] | null);
    const listing = one(data.listing as { title: string } | { title: string }[] | null);
    const employer = one(data.employer as { company_name: string } | { company_name: string }[] | null);
    if (!student?.user_id) return;

    const body = buildInterviewFormatMessage({
      format,
      companyName: employer?.company_name ?? 'The employer',
      listingTitle: listing?.title ?? 'the role',
      scheduledAt: data.scheduled_at,
      durationMinutes: data.duration_minutes,
      meetingUrl: data.meeting_url,
      timeZone: opts.timeZone,
      notes: data.employer_notes,
      rescheduled: opts.rescheduled,
    });
    if (!body) return;

    const { error } = await supabase.from('messages').insert({
      sender_id: opts.senderUserId,
      receiver_id: student.user_id,
      application_id: data.application_id,
      body,
    });
    if (error) console.error('[interview format message]', error.message);
  } catch (e) {
    console.error('[interview format message]', e);
  }
}
