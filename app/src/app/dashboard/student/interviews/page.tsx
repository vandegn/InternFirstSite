'use client';

import { useEffect, useState } from 'react';
import {
  supabase,
  getStudentByUserId,
  getStudentUpcomingInterviews,
} from '@/lib/supabase';
import UpcomingInterviewsList, { type UpcomingInterview } from '@/components/UpcomingInterviewsList';

const one = <T,>(v: unknown): T => (Array.isArray(v) ? v[0] : v) as T;

// The student's confirmed screenings and interviews, soonest first — the same
// meetings, with the same details, the employer sees on their page.
export default function StudentUpcomingInterviewsPage() {
  const [interviews, setInterviews] = useState<UpcomingInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const student = user ? await getStudentByUserId(user.id) : null;
      if (!student) { setLoading(false); return; }
      const rows = await getStudentUpcomingInterviews(student.id);
      setInterviews(rows.map(r => {
        const employer = one<{ company_name?: string } | null>(r.employer);
        const listing = one<{ title?: string } | null>(r.listing);
        return {
          id: r.id as string,
          applicationId: r.application_id as string,
          counterpart: employer?.company_name ?? 'Employer',
          jobTitle: listing?.title ?? 'Listing',
          meetingType: r.meeting_type as string | null,
          scheduledAt: r.scheduled_at as string,
          durationMinutes: r.duration_minutes as number,
          format: r.format as string | null,
          meetingUrl: r.meeting_url as string | null,
          notes: r.employer_notes as string | null,
        };
      }));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Upcoming Interviews</h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
        Your confirmed screenings and interviews, soonest first. Times are shown in your time zone.
      </p>
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <UpcomingInterviewsList
          role="student"
          interviews={interviews}
          emptyText="Nothing confirmed yet. When an employer offers interview times, pick one in Messages — it shows up here once they confirm."
        />
      )}
    </div>
  );
}
