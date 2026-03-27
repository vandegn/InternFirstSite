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

export default function StudentDashboard() {
  const [positionsCount, setPositionsCount] = useState(0);
  const [applicationCount, setApplicationCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const animatedPositions = useCountUp(positionsCount);
  const animatedApplications = useCountUp(applicationCount);
  const animatedOffers = useCountUp(offerCount);
  const [studentMajor, setStudentMajor] = useState<string | null>(null);
  const [graduationYear, setGraduationYear] = useState<number | null>(null);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
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
        setProfileEmail(profile.email);
        setProfileAvatar(profile.avatar_url);
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
      if (student?.graduation_year) {
        setGraduationYear(student.graduation_year);
      }

      const studentData = student;
      if (studentData?.university_id) {
        const { data: uniData } = await supabase
          .from('universities')
          .select('name')
          .eq('id', studentData.university_id)
          .single();
        if (uniData) setUniversityName(uniData.name);
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

  const firstName = profileName.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1280px' }}>
      {/* Welcome header + inline metrics */}
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
              transition: 'opacity 0.15s',
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Browse internships
          </Link>
        </div>

        {/* Inline metrics bar — no card borders */}
        <div style={{ display: 'flex', gap: '0', background: '#fff', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{animatedPositions}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Open positions</div>
            </div>
          </div>
          <div style={{ width: '1px', background: 'var(--border)', margin: '10px 0' }} />
          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{animatedApplications}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Applications</div>
            </div>
          </div>
          <div style={{ width: '1px', background: 'var(--border)', margin: '10px 0' }} />
          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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

      {/* 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px 220px', gap: '24px', alignItems: 'stretch' }}>

        {/* ── Left: Applications + School Events ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                {studentApplications.slice(0, 2).map((app, i) => {
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
                        padding: '12px 4px',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
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
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* School Events */}
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid var(--border)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
                School events
              </h3>
              <Link href="/dashboard/student/events" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                View all
              </Link>
            </div>
            {recentEvents.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '8px 0', margin: 0 }}>No upcoming events.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {recentEvents.slice(0, 4).map((event, i) => {
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 4px',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderRadius: '6px',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.48rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{month}</span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>{day}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {EVENT_TYPE_LABELS[event.event_type] || 'Event'}
                            {' \u00B7 '}
                            {event.is_virtual ? 'Virtual' : event.location || 'TBD'}
                            {' \u00B7 '}
                            {event.start_time?.slice(0, 5) || ''}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Calendar + Events ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%' }}>
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

          {/* Upcoming events */}
          {recentEvents.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid var(--border)', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Upcoming events</h3>
                <Link href="/dashboard/student/events" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                  View all
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentEvents.slice(0, 4).map((event) => {
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.48rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{month}</span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>{day}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {EVENT_TYPE_LABELS[event.event_type] || 'Event'}
                            {' \u00B7 '}
                            {event.start_time?.slice(0, 5) || ''}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Far Right: Profile overview ── */}
        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'start',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Profile</h3>
            <Link href="/dashboard/student/settings" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              Edit
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '18px' }}>
            {profileAvatar ? (
              <img src={profileAvatar} alt={profileName} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} />
            ) : (
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1.1rem',
                letterSpacing: '-0.02em',
                marginBottom: '10px',
              }}>
                {profileName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.2 }}>{profileName || '\u2014'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {profileEmail}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {universityName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{universityName}</span>
              </div>
            )}
            {studentMajor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <span>{studentMajor}</span>
              </div>
            )}
            {graduationYear && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>Class of {graduationYear}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Industry News */}
      <div style={{ marginTop: '24px' }}>
        {/* Industry News */}
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Industry news
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {studentMajor ? `For ${studentMajor} majors` : 'For your field'}
            </span>
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
                  transition: 'background 0.15s',
                  borderRadius: '6px',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg, #f9fafb)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '3px', lineHeight: 1.4 }}>
                  {article.title}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <span>{article.source}</span>
                  <span>{article.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
