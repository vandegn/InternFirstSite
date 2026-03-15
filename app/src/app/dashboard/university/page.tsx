'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

export default function UniversityDashboard() {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<DashEvent[]>([]);
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
    async function fetchEvents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: admin } = await supabase
        .from('university_admins')
        .select('university_id')
        .eq('user_id', user.id)
        .single();
      if (!admin?.university_id) return;
      const { data } = await supabase
        .from('university_events')
        .select('id, title, event_type, event_date, location, is_virtual')
        .eq('university_id', admin.university_id)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(3);
      if (data) setUpcomingEvents(data);
    }
    fetchEvents();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

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
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png" alt="Profile" />
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
            <Link href="/dashboard/university/inbox" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              My Inbox
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div className="stat-label">Students Placed</div>
                <div className="stat-value">0</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div>
                <div className="stat-label">Jobs Applied</div>
                <div className="stat-value">0</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
              </div>
              <div>
                <div className="stat-label">Students Enrolled</div>
                <div className="stat-value">0</div>
              </div>
            </div>
          </div>

          {/* Stats Row 2 */}
          <div className="dash-stats three-col">
            <div className="stat-card">
              <div className="stat-icon orange">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <div className="stat-label">Avg Time to Interview</div>
                <div className="stat-value">0 Days</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <div className="stat-label">Avg Response Time</div>
                <div className="stat-value">0 Hours</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <div className="stat-label">Internships Awarded</div>
                <div className="stat-value">0%</div>
              </div>
            </div>
          </div>

          {/* Stats Row 3 */}
          <div className="dash-stats three-col">
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div>
                <div className="stat-label">Average Pay</div>
                <div className="stat-value">$0/Hour</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <div className="stat-label">Active Partners</div>
                <div className="stat-value">0</div>
              </div>
            </div>
            <div className="stat-card top-employers">
              <h5>Top 3 Employers</h5>
              <div className="employer-list">
                <div className="employer-row"><span>ABC Inc.</span><strong>12</strong></div>
                <div className="employer-row"><span>DEF Inc.</span><strong>9</strong></div>
                <div className="employer-row"><span>GHI Inc.</span><strong>7</strong></div>
              </div>
            </div>
          </div>

          {/* Placement by City */}
          <div className="dash-section">
            <h3 className="dash-section-title">Placement by City</h3>
            <div className="chart-container">
              <div className="bar-chart">
                <div className="bar-item">
                  <div className="bar-label">San Francisco</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: '100%', background: '#0464AE' }}>
                      <span>120</span>
                    </div>
                  </div>
                </div>
                <div className="bar-item">
                  <div className="bar-label">New York</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: '79%', background: '#EA450D' }}>
                      <span>95</span>
                    </div>
                  </div>
                </div>
                <div className="bar-item">
                  <div className="bar-label">Austin</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: '67%', background: '#00A878' }}>
                      <span>80</span>
                    </div>
                  </div>
                </div>
                <div className="bar-item">
                  <div className="bar-label">Seattle</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: '54%', background: '#F4A261' }}>
                      <span>65</span>
                    </div>
                  </div>
                </div>
                <div className="bar-item">
                  <div className="bar-label">Boston</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: '42%', background: '#6A4C93' }}>
                      <span>50</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png" alt="Intern State University" className="profile-avatar" />
            <h4>Intern State University</h4>
            <p className="profile-email">info@isu.edu</p>
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
