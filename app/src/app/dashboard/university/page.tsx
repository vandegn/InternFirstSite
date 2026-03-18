'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getProfile, getUnreadCount, getUniversityStats, getTopEmployersForUniversity, getPlacementCities } from '@/lib/supabase';

type DashEvent = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  location: string | null;
  is_virtual: boolean;
};

const DOT_COLORS: Record<string, string> = {
  career_fair: 'blue',
  info_session: 'green',
  workshop: 'purple',
  networking: 'orange',
  other: 'blue',
};

const BAR_COLORS = ['#0464AE', '#EA450D', '#00A878', '#F4A261', '#6A4C93'];

export default function UniversityDashboard() {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [universityName, setUniversityName] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState<DashEvent[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Stats
  const [studentsEnrolled, setStudentsEnrolled] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [offers, setOffers] = useState(0);
  const [interviewing, setInterviewing] = useState(0);
  const [topEmployers, setTopEmployers] = useState<{ name: string; count: number }[]>([]);
  const [cities, setCities] = useState<{ city: string; count: number }[]>([]);

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

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await getProfile(user.id);
      if (profile) {
        setProfileName(profile.full_name);
        setProfileEmail(profile.email);
        setProfileAvatar(profile.avatar_url);
      }

      const [unread] = await Promise.all([getUnreadCount(user.id)]);
      setUnreadMessages(unread);

      const { data: admin } = await supabase
        .from('university_admins')
        .select('university_id')
        .eq('user_id', user.id)
        .single();
      if (!admin?.university_id) return;

      // Get university name
      const { data: uni } = await supabase
        .from('universities')
        .select('name')
        .eq('id', admin.university_id)
        .single();
      if (uni) setUniversityName(uni.name);

      // Fetch all data in parallel
      const [stats, employers, placementCities, eventsResult] = await Promise.all([
        getUniversityStats(admin.university_id),
        getTopEmployersForUniversity(admin.university_id),
        getPlacementCities(admin.university_id),
        supabase
          .from('university_events')
          .select('id, title, event_type, event_date, location, is_virtual')
          .eq('university_id', admin.university_id)
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .limit(3),
      ]);

      setStudentsEnrolled(stats.studentsEnrolled);
      setTotalApplications(stats.totalApplications);
      setOffers(stats.offers);
      setInterviewing(stats.interviewing);
      setTopEmployers(employers);
      setCities(placementCities);
      if (eventsResult.data) setUpcomingEvents(eventsResult.data);
    }
    fetchData();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const awardRate = totalApplications > 0 ? Math.round((offers / totalApplications) * 100) : 0;
  const maxCityCount = cities.length > 0 ? cities[0].count : 1;

  return (
    <div className="dashboard-body">
      {/* Dashboard Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <Link href="/" className="logo">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
          <span className="portal-label">University Dashboard</span>
          <nav className="main-nav">
            <ul>
              <li><Link href="/dashboard/university" className="active">Dashboard</Link></li>
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
              <img src={profileAvatar || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png'} alt={profileName || 'Profile'} />
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
            <Link href="/dashboard/university" className="sidebar-link active">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home
            </Link>
            <Link href="/dashboard/university/events" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              My Events
            </Link>
            <Link href="/dashboard/university/inbox" className="sidebar-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                My Inbox
              </span>
              {unreadMessages > 0 && (
                <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>
                  {unreadMessages}
                </span>
              )}
            </Link>
            <Link href="/dashboard/university/connect" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Connect
            </Link>
            <Link href="/dashboard/university/news" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/><path d="M21 12a9 9 0 0 1-9 9"/><path d="M21 8v4h-4"/><line x1="3" y1="10" x2="15" y2="10"/><line x1="3" y1="14" x2="12" y2="14"/></svg>
              News
            </Link>
            <Link href="/dashboard/university/resources" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              Resources
            </Link>
          </nav>
        </aside>

        <main className="dash-main">
          {/* Upcoming Events */}
          <div className="dash-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="dash-section-title">Upcoming Events</h3>
              <Link href="/dashboard/university/events/new" className="btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                + Create Event
              </Link>
            </div>
            <div className="event-list">
              {upcomingEvents.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '12px 0' }}>
                  No upcoming events.{' '}
                  <Link href="/dashboard/university/events/new" style={{ color: 'var(--primary)', fontWeight: 500 }}>Create one</Link> to get started!
                </p>
              ) : (
                upcomingEvents.map((event) => {
                  const date = new Date(event.event_date + 'T00:00:00');
                  const formatted = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  return (
                    <Link href={`/dashboard/university/events`} key={event.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="event-item" style={{ cursor: 'pointer' }}>
                        <div className={`event-dot ${DOT_COLORS[event.event_type] || 'blue'}`}></div>
                        <div className="event-info">
                          <strong>{event.title}</strong>
                          <span>{formatted} - {event.is_virtual ? 'Virtual' : event.location || 'Location TBD'}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Stats Row 1 */}
          <div className="dash-stats three-col">
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
              </div>
              <div>
                <div className="stat-label">Students on Platform</div>
                <div className="stat-value">{studentsEnrolled}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div>
                <div className="stat-label">Total Applications</div>
                <div className="stat-value">{totalApplications}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div className="stat-label">Students Placed</div>
                <div className="stat-value">{offers}</div>
              </div>
            </div>
          </div>

          {/* Stats Row 2 */}
          <div className="dash-stats three-col">
            <div className="stat-card">
              <div className="stat-icon orange">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div>
                <div className="stat-label">Interviewing</div>
                <div className="stat-value">{interviewing}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <div className="stat-label">Offer Rate</div>
                <div className="stat-value">{awardRate}%</div>
              </div>
            </div>
            <div className="stat-card top-employers">
              <h5>Top Employers</h5>
              <div className="employer-list">
                {topEmployers.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '8px 0' }}>No application data yet</p>
                ) : (
                  topEmployers.map((emp) => (
                    <div className="employer-row" key={emp.name}>
                      <span>{emp.name}</span>
                      <strong>{emp.count}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Placement by City */}
          <div className="dash-section">
            <h3 className="dash-section-title">Placement by City</h3>
            {cities.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '12px 0' }}>
                No placement data yet. Cities will appear here as students receive offers.
              </p>
            ) : (
              <div className="chart-container">
                <div className="bar-chart">
                  {cities.map((c, i) => (
                    <div className="bar-item" key={c.city}>
                      <div className="bar-label">{c.city}</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${Math.round((c.count / maxCityCount) * 100)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
                        >
                          <span>{c.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* News */}
          <div className="dash-section">
            <h3 className="dash-section-title">News</h3>
            <div className="news-grid">
              <div className="news-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-3.png" alt="News 1" />
                <div className="news-body">
                  <div className="news-meta">
                    <span>Feb 20, 2026</span>
                    <span>5 min read</span>
                  </div>
                  <h4>How to Attract Top Intern Talent in 2026</h4>
                  <Link href="/blog">Read more</Link>
                </div>
              </div>
              <div className="news-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-4.png" alt="News 2" />
                <div className="news-body">
                  <div className="news-meta">
                    <span>Feb 18, 2026</span>
                    <span>4 min read</span>
                  </div>
                  <h4>The Future of Remote Internships: What Employers Need to Know</h4>
                  <Link href="/blog">Read more</Link>
                </div>
              </div>
              <div className="news-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-5.png" alt="News 3" />
                <div className="news-body">
                  <div className="news-meta">
                    <span>Feb 15, 2026</span>
                    <span>6 min read</span>
                  </div>
                  <h4>Building a Pipeline: University Partnerships That Work</h4>
                  <Link href="/blog">Read more</Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar - University profile */}
        <aside className="dash-profile">
          <div className="profile-card">
            <img src={profileAvatar || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png'} alt={profileName || 'Profile'} className="profile-avatar" />
            <h4>{profileName || 'University Admin'}</h4>
            <p className="profile-email">{profileEmail}</p>
            {universityName && (
              <p style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.9rem', marginTop: '4px' }}>{universityName}</p>
            )}
            <div className="profile-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '100%' }}></div>
              </div>
              <span>100% Complete</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
