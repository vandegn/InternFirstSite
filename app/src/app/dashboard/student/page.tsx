'use client';

import { useState, useEffect, useRef } from 'react';

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
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
import Link from 'next/link';
import { supabase, getProfile, getStudentByUserId, getStudentStats, getStudentApplications } from '@/lib/supabase';
import Calendar, { CalendarEvent } from '@/components/Calendar';

type Event = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  is_virtual: boolean;
  registration_count: number;
};

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

export default function StudentDashboard() {
  const [positionsCount, setPositionsCount] = useState(0);
  const [applicationCount, setApplicationCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const animatedPositions = useCountUp(positionsCount);
  const animatedApplications = useCountUp(applicationCount);
  const animatedOffers = useCountUp(offerCount);
  const [studentMajor, setStudentMajor] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [studentApplications, setStudentApplications] = useState<StudentApplication[]>([]);
  const [profileName, setProfileName] = useState('');

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

      // Fetch student data for recommendations, events, and stats
      const student = await getStudentByUserId(user.id);
      if (student) {
        const [stats, apps] = await Promise.all([
          getStudentStats(student.id),
          getStudentApplications(student.id),
        ]);
        setApplicationCount(stats.total);
        setOfferCount(stats.offers);
        setStudentApplications(apps as unknown as StudentApplication[]);
      }
      if (student?.major) {
        setStudentMajor(student.major);
      }

      const studentData = student;
      if (studentData?.university_id) {
        const { data: events } = await supabase
          .from('university_events')
          .select('id, title, event_type, event_date, start_time, end_time, location, is_virtual')
          .eq('university_id', studentData.university_id)
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

  return (
    <>
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

      {/* 3-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: '24px', marginTop: '24px' }}>

        {/* ── Left Column: Events ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* School Events */}
          <div style={{ background: '#fff', borderRadius: 'var(--radius, 12px)', border: '1px solid var(--border, #e5e7eb)', padding: '16px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text, #1a1a1a)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px' }}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
              School Events
            </h3>
            {recentEvents.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '8px 0' }}>No upcoming events.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentEvents.map((event) => {
                  const date = new Date(event.event_date + 'T00:00:00');
                  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
                  const day = date.getDate();
                  return (
                    <Link
                      href={`/dashboard/student/events/${event.id}`}
                      key={event.id}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border, #e5e7eb)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.15s, border-color 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(123,97,255,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{month}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>{day}</span>
                          </div>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: 'var(--primary)',
                            background: 'var(--primary-light)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                          }}>
                            {EVENT_TYPE_LABELS[event.event_type] || 'Event'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '3px', lineHeight: 1.3 }}>{event.title}</h4>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                          {event.is_virtual ? 'Virtual' : event.location || 'Location TBD'}
                          {' \u00B7 '}
                          {event.start_time?.slice(0, 5)}{event.end_time ? ` - ${event.end_time.slice(0, 5)}` : ''}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <Link href="/dashboard/student/events" style={{
              display: 'block',
              textAlign: 'center',
              marginTop: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--primary)',
              textDecoration: 'none',
            }}>
              View All Events &rarr;
            </Link>
          </div>

          {/* Local Employer Events placeholder */}
          <div style={{ background: '#fff', borderRadius: 'var(--radius, 12px)', border: '1px solid var(--border, #e5e7eb)', padding: '16px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text, #1a1a1a)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Local Employer Events
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '8px 0', lineHeight: 1.5 }}>
              Employer-hosted events in your area will appear here soon.
            </p>
          </div>
        </div>

        {/* ── Center Column: Applications + Calendar ── */}
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

                  return (
                    <Link
                      href={`/dashboard/student/internships/${listing?.id}`}
                      key={app.id}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 8px',
                        borderBottom: '1px solid var(--border, #f3f4f6)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Company logo */}
                        {employer?.logo_url ? (
                          <img src={employer.logo_url} alt={employer.company_name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', flexShrink: 0 }}>
                            {employer?.company_name?.charAt(0) || '?'}
                          </div>
                        )}
                        {/* Job info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {listing?.title || 'Untitled Position'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {employer?.company_name || 'Unknown Company'}
                          </div>
                        </div>
                        {/* Status badge */}
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
                        {/* Date */}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0, minWidth: '48px', textAlign: 'right' }}>
                          {dateStr}
                        </span>
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
              {/* Placeholder article 1 */}
              <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e5e7eb)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
              >
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.4 }}>
                  Top Skills Employers Are Looking For in 2026
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  <span>InternFirst Blog</span>
                  <span>Mar 22, 2026</span>
                </div>
              </div>

              {/* Placeholder article 2 */}
              <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e5e7eb)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
              >
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.4 }}>
                  How to Stand Out in Your Internship Application
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  <span>Career Insights</span>
                  <span>Mar 20, 2026</span>
                </div>
              </div>

              {/* Placeholder article 3 */}
              <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e5e7eb)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
              >
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.4 }}>
                  Remote Internships: What to Expect and How to Succeed
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  <span>The Intern Guide</span>
                  <span>Mar 18, 2026</span>
                </div>
              </div>

              {/* Placeholder article 4 */}
              <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #e5e7eb)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
              >
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', lineHeight: 1.4 }}>
                  Networking Tips for College Students Breaking Into the Industry
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  <span>Campus Weekly</span>
                  <span>Mar 15, 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
