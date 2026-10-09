'use client';

import { useEffect, useState } from 'react';
import {
  supabase,
  getEmployerByUserId,
  getEmployerUpcomingInterviews,
} from '@/lib/supabase';
import UpcomingInterviewsList, { type UpcomingInterview } from '@/components/UpcomingInterviewsList';
import CandidateApplicationModal from '@/components/CandidateApplicationModal';

const one = <T,>(v: unknown): T => (Array.isArray(v) ? v[0] : v) as T;

// Confirmed screenings and interviews this employer user owns, soonest first.
// Each opens the candidate's expanded application in place.
export default function EmployerUpcomingInterviewsPage() {
  const [interviews, setInterviews] = useState<UpcomingInterview[]>([]);
  const [loading, setLoading] = useState(true);
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
      const rows = await getEmployerUpcomingInterviews(employer.id, user.id);
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

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Upcoming Interviews</h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
        Confirmed screenings and interviews you’re running, soonest first. Times are shown in your time zone.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <UpcomingInterviewsList
          role="employer"
          interviews={interviews}
          onOpenApplication={setOpenApplicationId}
          emptyText="No confirmed screenings or interviews yet. Request a time from a candidate’s application on the Pipeline."
        />
      )}

      <CandidateApplicationModal
        applicationId={openApplicationId}
        onClose={() => setOpenApplicationId(null)}
        onChanged={() => setReloadKey(k => k + 1)}
      />
    </div>
  );
}
