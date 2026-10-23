'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  supabase,
  getStudentByUserId,
  getStudentConfirmedInterviews,
} from '@/lib/supabase';
import InterviewsList, { type InterviewListItem } from '@/components/InterviewsList';
import InterviewTabs, { type InterviewTab } from '@/components/InterviewTabs';
import { splitInterviewsByTime } from '@/lib/interview-join';

const one = <T,>(v: unknown): T => (Array.isArray(v) ? v[0] : v) as T;

// The student's confirmed screenings and interviews — upcoming ones with the
// Join button, past ones as the record — the same meetings, with the same
// details, the employer sees on their page.
export default function StudentInterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<InterviewTab>('upcoming');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const student = user ? await getStudentByUserId(user.id) : null;
      if (!student) { setLoading(false); return; }
      const rows = await getStudentConfirmedInterviews(student.id);
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

  const { upcoming, past } = useMemo(() => splitInterviewsByTime(interviews), [interviews]);

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Interviews</h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
        {tab === 'upcoming'
          ? 'Your confirmed screenings and interviews, soonest first. Times are shown in your time zone.'
          : 'Screenings and interviews you’ve already had, most recent first.'}
      </p>

      <InterviewTabs
        tab={tab}
        counts={loading ? null : { upcoming: upcoming.length, past: past.length }}
        onChange={setTab}
      />

      <div role="tabpanel" id={`interviews-panel-${tab}`} aria-labelledby={`interviews-tab-${tab}`}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : tab === 'upcoming' ? (
          <InterviewsList
            role="student"
            variant="upcoming"
            interviews={upcoming}
            emptyText="Nothing confirmed yet. When an employer offers interview times, pick one in Messages — it shows up here once they confirm."
          />
        ) : (
          <InterviewsList
            role="student"
            variant="past"
            interviews={past}
            emptyText="No past interviews yet. Meetings move here once they’ve ended."
          />
        )}
      </div>
    </div>
  );
}
