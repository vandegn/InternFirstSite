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
import { useRouter } from 'next/navigation';
import { supabase, getPartnerUniversity, getProfile, getActiveListings } from '@/lib/supabase';

type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  created_at: string;
  employers: {
    company_name: string;
    logo_url: string | null;
  };
};

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

const EVENT_TYPE_LABELS: Record<string, string> = {
  career_fair: 'Career Fair',
  info_session: 'Info Session',
  workshop: 'Workshop',
  networking: 'Networking',
  other: 'Event',
};

export default function StudentDashboard() {
  const [partnerLogo, setPartnerLogo] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [positionsCount, setPositionsCount] = useState(0);
  const animatedPositions = useCountUp(positionsCount);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

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

      const { count } = await supabase
        .from('internship_listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      setPositionsCount(count ?? 0);
      const result = await getActiveListings(1, 3);
      setRecentListings(result.data as Listing[]);

      // Fetch recent events for the student's university
      const { data: studentData } = await supabase
        .from('students')
        .select('university_id')
        .eq('user_id', user.id)
        .single();
      if (studentData?.university_id) {
        const { data: events } = await supabase
          .from('university_events')
          .select('id, title, event_type, event_date, start_time, end_time, location, is_virtual')
          .eq('university_id', studentData.university_id)
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .limit(3);
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

      if (user.email) {
        const partner = await getPartnerUniversity(user.email);
        if (partner) {
          setPartnerLogo(partner.logo_url);
          setPartnerName(partner.name);
        }
      }
    }
    fetchUserData();
  }, []);

  return (
    <div className="dashboard-body">
      {/* Dashboard Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <Link href="/" className="logo">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
          <span className="portal-label">Student Dashboard</span>
          {partnerLogo && (
            <>
              <span className="logo-divider"></span>
              <img src={partnerLogo} alt={partnerName || 'University'} className="partner-logo" />
            </>
          )}
          <nav className="main-nav">
            <ul>
              <li><Link href="/dashboard/student" className="active">Dashboard</Link></li>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </nav>
          <div className="dash-header-right">
            <div className="dash-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search..." />
            </div>
            <div className="dash-avatar" ref={avatarRef} onClick={() => setAvatarOpen(!avatarOpen)}>
              <img src={profileAvatar || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'} alt={profileName || 'Profile'} />
              {avatarOpen && (
                <div className="avatar-dropdown">
                  <button onClick={handleSignOut} className="avatar-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="dash-layout">
        {/* Sidebar */}
        <aside className="dash-sidebar">
          <nav className="sidebar-nav">
            <Link href="/dashboard/student" className="sidebar-link active">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home
            </Link>
            <Link href="/dashboard/student/internships" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
              Internships
            </Link>
            <Link href="/dashboard/student/events" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              My Events
            </Link>
            <Link href="/dashboard/student" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              My Inbox
            </Link>
            <Link href="/dashboard/student" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Connect
            </Link>
            <Link href="/dashboard/student" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              News
            </Link>
            <Link href="/career-resources" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Resources
            </Link>
            <div className="sidebar-divider"></div>
            <Link href="/dashboard/student" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>
              Settings
            </Link>
            <Link href="/dashboard/student" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Help Center
            </Link>
          </nav>
        </aside>

        {/* Main content */}
        <main className="dash-main">
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
                <div className="stat-value">0</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <div className="stat-label">Offers</div>
                <div className="stat-value">0</div>
              </div>
            </div>
          </div>

          {/* Browse Internships */}
          <div className="dash-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="dash-section-title">Browse Internships</h3>
              <Link href="/dashboard/student/internships" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', border: '1.5px solid var(--primary)', borderRadius: '999px', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 500, textDecoration: 'none', transition: 'background 0.15s, color 0.15s', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--primary)'; }}
              >
                View All <span style={{ fontSize: '1.1rem' }}>&rarr;</span>
              </Link>
            </div>
            {recentListings.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
                No internships available yet. Check back soon!
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                {recentListings.map((listing) => (
                  <Link
                    href={`/dashboard/student/internships/${listing.id}`}
                    key={listing.id}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="listing-card" style={{ padding: '14px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        {listing.employers?.logo_url ? (
                          <img src={listing.employers.logo_url} alt={listing.employers.company_name} className="listing-logo" style={{ width: 32, height: 32 }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem', flexShrink: 0 }}>
                            {listing.employers?.company_name?.charAt(0) || '?'}
                          </div>
                        )}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{listing.employers?.company_name}</span>
                      </div>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{listing.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{listing.location || 'Location not specified'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{listing.compensation || 'TBD'}</span>
                        {listing.is_remote && <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>Remote</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="dash-section" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="dash-section-title">Upcoming Events</h3>
              <Link href="/dashboard/student/events" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', border: '1.5px solid var(--primary)', borderRadius: '999px', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 500, textDecoration: 'none', transition: 'background 0.15s, color 0.15s', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--primary)'; }}
              >
                View All <span style={{ fontSize: '1.1rem' }}>&rarr;</span>
              </Link>
            </div>
            {recentEvents.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
                No upcoming events. Check back soon!
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
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
                      <div className="listing-card" style={{ padding: '14px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{month}</span>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>{day}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
                            {EVENT_TYPE_LABELS[event.event_type] || 'Event'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{event.title}</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          {event.is_virtual ? 'Virtual' : event.location || 'Location TBD'}
                          {' · '}
                          {event.start_time?.slice(0, 5)}{event.end_time ? ` - ${event.end_time.slice(0, 5)}` : ''}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          {event.registration_count} attending
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Right sidebar - Profile */}
        <aside className="dash-profile">
          <div className="profile-card">
            <img src={profileAvatar || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'} alt={profileName || 'Profile'} className="profile-avatar" />
            <h4>{profileName || 'Student'}</h4>
            <p className="profile-email">{profileEmail}</p>
            <div className="profile-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '100%' }}></div>
              </div>
              <span>100% Complete</span>
            </div>
            <ul className="profile-checklist">
              <li className="checked">Personal Info</li>
              <li className="checked">Work Experience</li>
              <li className="checked">Education</li>
              <li className="checked">Training and Certifications</li>
              <li className="checked">Skills</li>
            </ul>
            <div className="profile-settings">
              <div className="profile-setting">
                <span>Profile Visibility</span>
                <strong>Public</strong>
              </div>
              <div className="profile-setting">
                <span>Job Preferences</span>
                <strong>No Preference Yet</strong>
              </div>
              <div className="profile-setting">
                <span>Open To Work</span>
                <strong className="status-green">Open to work</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
