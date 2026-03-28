'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase, getProfile, getStudentByUserId, getStudentStats, getStudentApplications, getCareerSurvey, upsertCareerSurvey } from '@/lib/supabase';
import Calendar, { CalendarEvent } from '@/components/Calendar';
import CareerSurveyModal from '@/components/CareerSurveyModal';
import type { CareerSurveyFormData } from '@/components/CareerSurveyModal';

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
    employers: {
      company_name: string;
      logo_url: string | null;
    };
  };
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  career_fair: 'Career Fair',
  info_session: 'Info Session',
  workshop: 'Workshop',
  networking: 'Networking',
  other: 'Event',
};

const ATS_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  applied: { label: 'Application Submitted', color: '#2563eb', bg: '#eff6ff' },
  under_review: { label: 'Under Review', color: '#d97706', bg: '#fffbeb' },
  reviewing: { label: 'Under Review', color: '#d97706', bg: '#fffbeb' },
  interviewing: { label: 'Interview Requested', color: '#7c3aed', bg: '#f5f3ff' },
  interview_scheduled: { label: 'Interview Scheduled', color: '#059669', bg: '#ecfdf5' },
  offered: { label: 'Offer Extended', color: '#059669', bg: '#ecfdf5' },
  rejected: { label: 'Rejected/Closed', color: '#dc2626', bg: '#fef2f2' },
  closed: { label: 'Rejected/Closed', color: '#6b7280', bg: '#f3f4f6' },
  not_selected: { label: 'Rejected/Closed', color: '#dc2626', bg: '#fef2f2' },
};

const ATS_STAGES = ['applied', 'under_review', 'interviewing', 'interview_scheduled', 'offered'] as const;
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
  const [profileName, setProfileName] = useState('');
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [studentApplications, setStudentApplications] = useState<StudentApplication[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [rsvpEventIds, setRsvpEventIds] = useState<Set<string>>(new Set());
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyLoaded, setSurveyLoaded] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

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
        const existingSurvey = await getCareerSurvey(student.id);
        if (existingSurvey) {
          setSurveyCompleted(true);
        }
        setSurveyLoaded(true);
        const [stats, apps] = await Promise.all([
          getStudentStats(student.id),
          getStudentApplications(student.id),
        ]);
        setApplicationCount(stats.total);
        setOfferCount(stats.offers);
        setStudentApplications(apps as unknown as StudentApplication[]);

        const { data: myRsvps } = await supabase
          .from('event_registrations')
          .select('event_id')
          .eq('student_id', student.id);
        if (myRsvps) {
          setRsvpEventIds(new Set(myRsvps.map(r => r.event_id)));
        }
      }
      if (student?.major) setStudentMajor(student.major);

      if (student?.university_id) {
        const { data: events } = await supabase
          .from('university_events')
          .select('id, title, event_type, event_date, start_time, end_time, location, is_virtual')
          .eq('university_id', student.university_id)
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .limit(10);
        if (events && events.length > 0) {
          const eventIds = events.map(e => e.id);
          const { data: regCounts } = await supabase
            .from('event_registrations')
            .select('event_id')
            .in('event_id', eventIds);
          const countMap: Record<string, number> = {};
          regCounts?.forEach(r => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });
          setRecentEvents(events.map(e => ({ ...e, registration_count: countMap[e.id] || 0 })));
        }
      }
    }
    fetchUserData();
  }, []);

  async function toggleRsvp(eventId: string) {
    if (!studentId || rsvpLoading) return;
    setRsvpLoading(eventId);
    const isRsvpd = rsvpEventIds.has(eventId);
    try {
      if (isRsvpd) {
        await supabase.from('event_registrations')
          .delete()
          .eq('event_id', eventId)
          .eq('student_id', studentId);
        setRsvpEventIds(prev => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
        setRecentEvents(prev => prev.map(e =>
          e.id === eventId ? { ...e, registration_count: Math.max(0, e.registration_count - 1) } : e
        ));
      } else {
        await supabase.from('event_registrations')
          .insert({ event_id: eventId, student_id: studentId });
        setRsvpEventIds(prev => new Set([...prev, eventId]));
        setRecentEvents(prev => prev.map(e =>
          e.id === eventId ? { ...e, registration_count: e.registration_count + 1 } : e
        ));
      }
    } finally {
      setRsvpLoading(null);
    }
  }

  const firstName = profileName.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1280px' }}>

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

      {/* ── Welcome header ── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em', color: 'var(--text-primary, #0f172a)' }}>
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
              {studentMajor ? `${studentMajor} major` : 'Here\u2019s your overview'}
              {' \u00B7 '}
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link
            href="/dashboard/student/internships"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Browse internships
          </Link>
        </div>

        {/* Metrics — asymmetric grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', background: '#fff', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{animatedPositions}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Open positions</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{animatedApplications}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Applications</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{animatedOffers}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Offers</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-Column Layout: Events | ATS + Calendar | News ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.2fr', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT: School & Local Events ── */}
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
              Events
            </h3>
            <Link href="/dashboard/student/events" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          {recentEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>No upcoming events</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {recentEvents.slice(0, 6).map((event, i) => {
                const date = new Date(event.event_date + 'T00:00:00');
                const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
                const day = date.getDate();
                const isRsvpd = rsvpEventIds.has(event.id);
                const isLoading = rsvpLoading === event.id;
                return (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 4px',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      borderRadius: '6px',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Link
                      href={`/dashboard/student/events/${event.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.44rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1, letterSpacing: '0.03em' }}>{month}</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>{day}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {EVENT_TYPE_LABELS[event.event_type] || 'Event'}
                          {' \u00B7 '}
                          {event.is_virtual ? 'Virtual' : event.location || 'TBD'}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => toggleRsvp(event.id)}
                      disabled={isLoading}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        border: isRsvpd ? '1px solid transparent' : '1px solid var(--border)',
                        background: isRsvpd ? 'var(--accent, #9FC63C)' : 'transparent',
                        color: isRsvpd ? '#fff' : 'var(--text-secondary)',
                        cursor: isLoading ? 'wait' : 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {isRsvpd && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                      {isRsvpd ? 'Going' : 'RSVP'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CENTER: My Applications (ATS) + Calendar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Applications ATS */}
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid var(--border)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>My Applications</h3>
              <Link href="/dashboard/student/applications" style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--primary)',
                textDecoration: 'none',
              }}>
                View all
              </Link>
            </div>
            {studentApplications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>No applications yet</p>
                <Link href="/dashboard/student/internships" style={{
                  display: 'inline-block',
                  padding: '8px 20px',
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}>
                  Browse internships
                </Link>
              </div>
            ) : (
              <div>
                {studentApplications.slice(0, 4).map((app, i) => {
                  const status = ATS_STATUS[app.status] || { label: app.status, color: '#6b7280', bg: '#f3f4f6' };
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
                        padding: '12px 4px',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
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
                            fontSize: '0.68rem',
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
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px', marginLeft: '48px', gap: '0' }}>
                          {ATS_STAGES.map((stage, si) => {
                            const isCompleted = !isRejected && si <= stageIdx;
                            const isCurrent = !isRejected && si === stageIdx;
                            const filledColor = isRejected ? '#f87171' : 'var(--accent, #9FC63C)';
                            const emptyColor = isRejected ? '#fecaca' : '#e5e7eb';
                            return (
                              <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <div style={{
                                  width: isCurrent ? 8 : 6,
                                  height: isCurrent ? 8 : 6,
                                  borderRadius: '50%',
                                  background: isCompleted ? filledColor : emptyColor,
                                  flexShrink: 0,
                                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                  boxShadow: isCurrent ? `0 0 0 3px ${isRejected ? 'rgba(248,113,113,0.2)' : 'rgba(159,198,60,0.2)'}` : 'none',
                                }} />
                                {si < ATS_STAGES.length - 1 && (
                                  <div style={{
                                    flex: 1,
                                    height: 2,
                                    background: (!isRejected && si < stageIdx) ? filledColor : emptyColor,
                                    transition: 'background 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
          <Calendar
            events={recentEvents.map((event): CalendarEvent => ({
              id: event.id,
              title: event.title,
              date: event.event_date,
              type: event.event_type === 'career_fair' ? 'career_fair'
                : event.event_type === 'info_session' ? 'info_session'
                : event.event_type === 'networking' ? 'event'
                : event.event_type === 'workshop' ? 'event'
                : 'event',
              time: event.start_time?.slice(0, 5) || undefined,
              location: event.is_virtual ? 'Virtual' : event.location || undefined,
            }))}
          />
        </div>

        {/* ── RIGHT: Industry News ── */}
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Industry news
            </h3>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {studentMajor ? `For ${studentMajor} majors` : 'For your field'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { title: 'Top Skills Employers Are Looking For in 2026', source: 'InternFirst Blog', date: 'Mar 22' },
              { title: 'How to Stand Out in Your Internship Application', source: 'Career Insights', date: 'Mar 20' },
              { title: 'Remote Internships: What to Expect and How to Succeed', source: 'The Intern Guide', date: 'Mar 18' },
              { title: 'Networking Tips for College Students Breaking Into the Industry', source: 'Campus Weekly', date: 'Mar 15' },
            ].map((article, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 4px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  borderRadius: '6px',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.4 }}>
                  {article.title}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  <span>{article.source}</span>
                  <span>{article.date}</span>
                </div>
              </div>
            ))}
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
    </div>
  );
}
