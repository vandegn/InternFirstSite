'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  supabase,
  getEmployerByUserId,
  getEmployerConfirmedInterviews,
} from '@/lib/supabase';
import InterviewsList, { type InterviewListItem } from '@/components/InterviewsList';
import InterviewTabs, { type InterviewTab } from '@/components/InterviewTabs';
import CandidateApplicationModal from '@/components/CandidateApplicationModal';
import { splitInterviewsByTime } from '@/lib/interview-join';

const one = <T,>(v: unknown): T => (Array.isArray(v) ? v[0] : v) as T;

// Confirmed screenings and interviews this employer user owns: upcoming ones
// with the Join button, past ones as the record. Each opens the candidate's
// expanded application in place.
export default function EmployerInterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<InterviewTab>('upcoming');
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(null);
  // Bumped when the modal reschedules something, to re-read the list.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const employer = user ? await getEmployerByUserId(user.id) : null;
      if (!user || !employer) {
        if (!cancelled) setLoading(false);
        return;
      }
      const rows = await getEmployerConfirmedInterviews(employer.id, user.id);
      if (cancelled) return;
      setInterviews(rows.map(r => {
        const student = one<{ profile?: unknown } | null>(r.student);
        const profile = one<{ full_name?: string } | null>(student?.profile);
        const listing = one<{ title?: string } | null>(r.listing);
        return {
          id: r.id as string,
          applicationId: r.application_id as string,
          counterpart: profile?.full_name ?? 'Candidate',
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
    return () => { cancelled = true; };
  }, [reloadKey]);

  const { upcoming, past } = useMemo(() => splitInterviewsByTime(interviews), [interviews]);

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Interviews</h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
        {tab === 'upcoming'
          ? 'Confirmed screenings and interviews you’re running, soonest first. Times are shown in your time zone.'
          : 'Screenings and interviews you’ve already run, most recent first.'}
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
            role="employer"
            variant="upcoming"
            interviews={upcoming}
            onOpenApplication={setOpenApplicationId}
            emptyText="No confirmed screenings or interviews yet. Request a time from a candidate’s application on the Pipeline."
          />
        ) : (
          <InterviewsList
            role="employer"
            variant="past"
            interviews={past}
            onOpenApplication={setOpenApplicationId}
            emptyText="No past interviews yet. Meetings move here once they’ve ended."
          />
        )}
      </div>

      <CandidateApplicationModal
        applicationId={openApplicationId}
        onClose={() => setOpenApplicationId(null)}
        onChanged={() => setReloadKey(k => k + 1)}
      />
    </div>
  );
}
