'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  supabase,
  getProfile,
  getStudentByUserId,
  getStudentStats,
  getStudentApplications,
  getCareerSurvey,
  upsertCareerSurvey,
  getStudentInterviews,
  respondToInterview,
  sendRescheduleRequestMessage,
  getRecommendedListings,
} from '@/lib/supabase';
import Calendar from '@/components/Calendar';
import type { CalendarEvent } from '@/components/Calendar';
import CareerSurveyModal from '@/components/CareerSurveyModal';
import type { CareerSurveyFormData } from '@/components/CareerSurveyModal';
import InterviewBanner from '@/components/InterviewBanner';
import InterviewResponseModal from '@/components/InterviewResponseModal';

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

type StudentApplication = {
  id: string;
  status: string;
  applied_at: string;
  updated_at: string;
  resume_id: string | null;
  listing: {
    id: string;
    title: string;
    location: string | null;
    is_remote: boolean;
    compensation: string | null;
    industry: string | null;
    application_deadline: string | null;
    employers: {
      company_name: string;
      logo_url: string | null;
    };
  };
};

const ACTIVE_APP_STATUSES = new Set(['applied', 'under_review', 'reviewing', 'reviewed', 'interviewing', 'interview_scheduled', 'offered']);

type RecommendedListing = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  is_hybrid: boolean;
  compensation: string | null;
  industry: string;
  employers: { company_name: string; logo_url: string | null };
};

type StudentInterview = {
  id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'pending' | 'accepted' | 'declined' | 'reschedule_requested' | 'cancelled' | 'completed';
  employer_notes: string | null;
  zoom_meeting_id?: string | null;
  listing: { id: string; title: string };
  employer: { id: string; company_name: string; logo_url: string | null; user_id?: string } | null;
};

function joinWindowStatus(scheduledAt: string, durationMinutes: number): 'too_early' | 'open' | 'ended' {
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes + 30) * 60 * 1000;
  if (now < start - 10 * 60 * 1000) return 'too_early';
  if (now > end) return 'ended';
  return 'open';
}

const ATS_STAGES = ['applied', 'under_review', 'interviewing', 'interview_scheduled', 'offered'] as const;
const ATS_LABELS: Record<string, string> = {
  applied: 'Applied',
  under_review: 'Review',
  interviewing: 'Interview',
  interview_scheduled: 'Scheduled',
  offered: 'Offered',
};
const REJECTED_STATUSES = new Set(['rejected', 'closed', 'not_selected']);

function getStageIndex(status: string): number {
  if (status === 'reviewed' || status === 'reviewing') return 1;
  const idx = ATS_STAGES.indexOf(status as typeof ATS_STAGES[number]);
  return idx >= 0 ? idx : 0;
}

export default function StudentDashboard() {
  const [positionsCount, setPositionsCount] = useState(0);
  const [applicationCount, setApplicationCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const animatedPositions = useCountUp(positionsCount);
  const animatedApplications = useCountUp(applicationCount);
  const animatedOffers = useCountUp(offerCount);
  const [studentMajor, setStudentMajor] = useState<string | null>(null);
  const [studentApplications, setStudentApplications] = useState<StudentApplication[]>([]);
  const [studentInterviews, setStudentInterviews] = useState<StudentInterview[]>([]);
  const [recommended, setRecommended] = useState<RecommendedListing[]>([]);
  const [profileName, setProfileName] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentUserId, setStudentUserId] = useState<string | null>(null);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyLoaded, setSurveyLoaded] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [interviewModalId, setInterviewModalId] = useState<string | null>(null);

  const pendingInterviews = useMemo(
    () => studentInterviews.filter(i => i.status === 'pending'),
    [studentInterviews],
  );
  const interviewModalRow = useMemo(
    () => studentInterviews.find(i => i.id === interviewModalId) ?? null,
    [studentInterviews, interviewModalId],
  );

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const deadlines = studentApplications
      .filter((app) => app.listing?.application_deadline && ACTIVE_APP_STATUSES.has(app.status))
      .map((app) => ({
        id: `deadline-${app.id}`,
        title: `${app.listing.title} — ${app.listing.employers.company_name}`,
        date: app.listing.application_deadline!.slice(0, 10),
        type: 'deadline',
      }));
    const interviews = studentInterviews
      .filter(i => i.status === 'accepted')
      .map(i => {
        const d = new Date(i.scheduled_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mn = String(d.getMinutes()).padStart(2, '0');
        return {
          id: `interview-${i.id}`,
          title: `Interview — ${i.employer?.company_name ?? 'Employer'}`,
          date: `${yyyy}-${mm}-${dd}`,
          time: `${hh}:${mn}`,
          type: 'interview',
        };
      });
    return [...deadlines, ...interviews];
  }, [studentApplications, studentInterviews]);

  useEffect(() => {
    async function fetchUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await getProfile(user.id);
      if (profile) {
        setProfileName(profile.full_name);
      }

      const [{ count }] = await Promise.all([
        supabase.from('internship_listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      setPositionsCount(count ?? 0);

      const student = await getStudentByUserId(user.id);
      if (student) {
        setStudentId(student.id);
        setStudentUserId(user.id);
        const existingSurvey = await getCareerSurvey(student.id);
        if (existingSurvey) {
          setSurveyCompleted(true);
        }
        setSurveyLoaded(true);
        const surveyIndustries = existingSurvey?.industries ?? [];
        const [stats, apps, interviews, recs] = await Promise.all([
          getStudentStats(student.id),
          getStudentApplications(student.id),
          getStudentInterviews(student.id),
          surveyIndustries.length > 0
            ? getRecommendedListings(surveyIndustries, 4)
            : Promise.resolve([]),
        ]);
        setApplicationCount(stats.total);
        setOfferCount(stats.offers);
        setStudentApplications(apps as unknown as StudentApplication[]);
        setStudentInterviews(interviews as unknown as StudentInterview[]);
        setRecommended(recs as unknown as RecommendedListing[]);
      }
      if (student?.major) {
        setStudentMajor(student.major);
      }
    }
    fetchUserData();
  }, []);

  async function handleInterviewResponse(action: 'accept' | 'decline' | 'reschedule', message?: string) {
    if (!interviewModalRow) return;

    if (action === 'accept') {
      // Accept goes through API route so Zoom meeting is provisioned server-side
      const res = await fetch(`/api/interviews/${interviewModalRow.id}/accept`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setStudentInterviews(prev => prev.map(i =>
          i.id === interviewModalRow.id ? { ...i, ...(updated as Partial<StudentInterview>) } : i
        ));
      }
    } else {
      const updated = await respondToInterview(interviewModalRow.id, action);
      setStudentInterviews(prev => prev.map(i =>
        i.id === interviewModalRow.id ? { ...i, ...(updated as unknown as Partial<StudentInterview>) } : i
      ));
      if (action === 'reschedule' && message && studentUserId && interviewModalRow.employer?.user_id) {
        try {
          await sendRescheduleRequestMessage({
            senderUserId: studentUserId,
            receiverUserId: interviewModalRow.employer.user_id,
            applicationId: interviewModalRow.application_id,
            body: message,
          });
        } catch {
          // Best-effort message; main state already updated.
        }
      }
    }

    setInterviewModalId(null);
  }

  return (
    <>
      {/* ── Interview Banner ── */}
      {pendingInterviews.length > 0 && (
        <InterviewBanner
          count={pendingInterviews.length}
          companyName={pendingInterviews[0].employer?.company_name ?? 'An employer'}
          scheduledAt={pendingInterviews[0].scheduled_at}
          onRespond={() => setInterviewModalId(pendingInterviews[0].id)}
        />
      )}

      {/* ── Survey Banner ── */}
      {surveyLoaded && !surveyCompleted && !bannerDismissed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '14px 20px',
          marginBottom: '24px',
          background: 'var(--accent-light, #eef5da)',
          border: '1px solid rgba(159, 198, 60, 0.25)',
          borderRadius: '10px',
          borderLeft: '4px solid var(--accent, #9FC63C)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark, #8ab32e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
              Complete your career goals survey
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Help us match you with better internship opportunities tailored to your interests.
            </div>
          </div>
          <button
            onClick={() => setSurveyOpen(true)}
            style={{
              padding: '7px 16px',
              background: 'var(--accent, #9FC63C)',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              flexShrink: 0,
            }}
          >
            Take survey
          </button>
          <button
            onClick={() => setBannerDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Dismiss survey"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Stats: 3 stat cards */}
      <div className="dash-stats">
        <div className="stat-card">
          <div className="stat-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
          </div>
          <div>
            <div className="stat-label">Positions Available</div>
            <div className="stat-value">{animatedPositions}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div>
            <div className="stat-label">Applications</div>
            <div className="stat-value">{animatedApplications}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <div className="stat-label">Offers</div>
            <div className="stat-value">{animatedOffers}</div>
          </div>
        </div>
      </div>

      {/* Upcoming Confirmed Interviews */}
      {studentInterviews.filter(i => i.status === 'accepted').length > 0 && (
        <div style={{ marginTop: '24px', background: '#fff', borderRadius: 'var(--radius, 12px)', border: '1px solid var(--border, #e5e7eb)', padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Upcoming Interviews</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {studentInterviews.filter(i => i.status === 'accepted').map(interview => {
              const ws = joinWindowStatus(interview.scheduled_at, interview.duration_minutes);
              const hasZoom = !!interview.zoom_meeting_id;
              const canJoin = ws === 'open' && hasZoom;
              const start = new Date(interview.scheduled_at);
              const timeStr = start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
              return (
                <div key={interview.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{interview.employer?.company_name ?? 'Employer'} — {interview.listing.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{timeStr} · {interview.duration_minutes} min</div>
                  </div>
                  {hasZoom ? (
                    <Link
                      href={canJoin ? `/dashboard/student/interviews/${interview.id}` : '#'}
                      onClick={e => { if (!canJoin) e.preventDefault(); }}
                      style={{
                        padding: '6px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
                        background: canJoin ? 'var(--primary)' : 'var(--border)',
                        color: canJoin ? '#fff' : 'var(--text-secondary)',
                        cursor: canJoin ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap',
                      }}
                      title={ws === 'too_early' ? `Joinable at ${new Date(new Date(interview.scheduled_at).getTime() - 10 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ws === 'ended' ? 'Interview ended' : 'Join Interview'}
                    >
                      {ws === 'too_early' ? 'Not yet open' : ws === 'ended' ? 'Ended' : 'Join Interview'}
                    </Link>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Video pending setup</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommended for You — driven by career survey industries */}
      {recommended.length > 0 && (
        <div style={{
          marginTop: '24px',
          background: '#fff',
          borderRadius: 'var(--radius, 12px)',
          border: '1px solid var(--border, #e5e7eb)',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recommended for You</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Based on the industries from your career goals survey
              </p>
            </div>
            <Link href="/dashboard/student/internships" style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--primary)',
              textDecoration: 'none',
            }}>
              Browse All &rarr;
            </Link>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}>
            {recommended.map((listing) => {
              const employer = listing.employers;
              return (
                <Link
                  key={listing.id}
                  href={`/dashboard/student/internships/${listing.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border, #e5e7eb)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {employer?.logo_url ? (
                        <img
                          src={employer.logo_url}
                          alt={employer.company_name}
                          style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: 6,
                          background: 'var(--primary-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, color: 'var(--primary)', fontSize: '0.8rem',
                          flexShrink: 0,
                        }}>
                          {employer?.company_name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {listing.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {employer?.company_name}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        background: 'var(--primary-light)',
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}>
                        {listing.industry}
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg, #f3f4f6)',
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}>
                        {listing.is_remote ? 'Remote' : listing.is_hybrid ? 'Hybrid' : listing.location || 'Location TBD'}
                      </span>
                      {listing.compensation && (
                        <span style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg, #f3f4f6)',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}>
                          {listing.compensation}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '24px', marginTop: '24px' }}>

        {/* ── Main Column: Applications + Calendar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          {/* My Applications Overview */}
          <div style={{ background: '#fff', borderRadius: 'var(--radius, 12px)', border: '1px solid var(--border, #e5e7eb)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>My Applications</h3>
              <Link href="/dashboard/student/applications" style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--primary)',
                textDecoration: 'none',
              }}>
                View All &rarr;
              </Link>
            </div>
            {studentApplications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>No applications yet. Start exploring internships!</p>
                <Link href="/dashboard/student/internships" style={{
                  display: 'inline-block',
                  marginTop: '12px',
                  padding: '8px 20px',
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}>
                  Browse Internships
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {studentApplications.slice(0, 5).map((app) => {
                  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                    applied: { label: 'Applied', color: '#2563eb', bg: '#eff6ff' },
                    under_review: { label: 'Under Review', color: '#d97706', bg: '#fffbeb' },
                    reviewing: { label: 'Under Review', color: '#d97706', bg: '#fffbeb' },
                    interviewing: { label: 'Interview Requested', color: '#7c3aed', bg: '#f5f3ff' },
                    interview_scheduled: { label: 'Interview Scheduled', color: '#059669', bg: '#ecfdf5' },
                    offered: { label: 'Offer Extended', color: '#059669', bg: '#ecfdf5' },
                    rejected: { label: 'Not Selected', color: '#dc2626', bg: '#fef2f2' },
                    closed: { label: 'Closed', color: '#6b7280', bg: '#f3f4f6' },
                    not_selected: { label: 'Not Selected', color: '#dc2626', bg: '#fef2f2' },
                  };
                  const status = statusConfig[app.status] || { label: app.status, color: '#6b7280', bg: '#f3f4f6' };
                  const listing = app.listing;
                  const employer = listing?.employers;
                  const appliedDate = new Date(app.applied_at);
                  const dateStr = appliedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const isRejected = REJECTED_STATUSES.has(app.status);
                  const stageIdx = getStageIndex(app.status);

                  return (
                    <Link
                      href={`/dashboard/student/internships/${listing?.id}`}
                      key={app.id}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{
                        padding: '12px 8px',
                        borderBottom: '1px solid var(--border, #f3f4f6)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {employer?.logo_url ? (
                            <img src={employer.logo_url} alt={employer.company_name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', flexShrink: 0 }}>
                              {employer?.company_name?.charAt(0) || '?'}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {listing?.title || 'Untitled Position'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {employer?.company_name || 'Unknown Company'}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: status.color,
                            background: status.bg,
                            padding: '3px 10px',
                            borderRadius: '999px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}>
                            {status.label}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0, minWidth: '48px', textAlign: 'right' }}>
                            {dateStr}
                          </span>
                        </div>
                        {/* ATS Progress Stepper */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '8px', marginLeft: '48px', gap: '0' }}>
                          {ATS_STAGES.map((stage, si) => {
                            const isCompleted = !isRejected && si <= stageIdx;
                            const isCurrent = !isRejected && si === stageIdx;
                            const filledColor = isRejected ? '#f87171' : 'var(--accent, #9FC63C)';
                            const emptyColor = isRejected ? '#fecaca' : '#e5e7eb';
                            return (
                              <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                                  <div style={{
                                    width: isCurrent ? 8 : 6,
                                    height: isCurrent ? 8 : 6,
                                    borderRadius: '50%',
                                    background: isCompleted ? filledColor : emptyColor,
                                    flexShrink: 0,
                                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: isCurrent ? `0 0 0 3px ${isRejected ? 'rgba(248,113,113,0.2)' : 'rgba(159,198,60,0.2)'}` : 'none',
                                  }} />
                                  <span style={{
                                    fontSize: '0.6rem',
                                    color: isCurrent ? (isRejected ? '#f87171' : 'var(--accent-dark, #8ab32e)') : isCompleted ? 'var(--text-secondary)' : '#c0c4cc',
                                    fontWeight: isCurrent ? 600 : 400,
                                    marginTop: '3px',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {ATS_LABELS[stage]}
                                  </span>
                                </div>
                                {si < ATS_STAGES.length - 1 && (
                                  <div style={{
                                    flex: 1,
                                    height: 2,
                                    background: (!isRejected && si < stageIdx) ? filledColor : emptyColor,
                                    transition: 'background 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                    marginTop: '-10px',
                                  }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Calendar */}
          <Calendar events={calendarEvents} />
        </div>

        {/* ── Right Column: Industry News ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fff', borderRadius: 'var(--radius, 12px)', border: '1px solid var(--border, #e5e7eb)', padding: '16px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text, #1a1a1a)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px' }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Industry News
            </h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
              {studentMajor ? `Curated for ${studentMajor} majors` : 'Curated for your field'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { title: 'Top Skills Employers Are Looking For in 2026', source: 'InternFirst Blog', date: 'Mar 22, 2026' },
                { title: 'How to Stand Out in Your Internship Application', source: 'Career Insights', date: 'Mar 20, 2026' },
                { title: 'Remote Internships: What to Expect and How to Succeed', source: 'The Intern Guide', date: 'Mar 18, 2026' },
                { title: 'Networking Tips for College Students Breaking Into the Industry', source: 'Campus Weekly', date: 'Mar 15, 2026' },
              ].map((article, i) => (
                <div
                  key={i}
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e5e7eb)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
                >
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.4 }}>
                    {article.title}
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    <span>{article.source}</span>
                    <span>{article.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <CareerSurveyModal
        open={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        onSubmit={async (data: CareerSurveyFormData) => {
          if (!studentId) return;
          try {
            await upsertCareerSurvey(studentId, data);
            setSurveyCompleted(true);
            setSurveyOpen(false);
          } catch (err) {
            console.error('Failed to save survey:', err);
          }
        }}
      />

      {interviewModalRow && (
        <InterviewResponseModal
          open={interviewModalId !== null}
          onClose={() => setInterviewModalId(null)}
          onSubmit={handleInterviewResponse}
          companyName={interviewModalRow.employer?.company_name ?? 'Employer'}
          listingTitle={interviewModalRow.listing.title}
          scheduledAt={interviewModalRow.scheduled_at}
          durationMinutes={interviewModalRow.duration_minutes}
          notes={interviewModalRow.employer_notes}
        />
      )}
    </>
  );
}
