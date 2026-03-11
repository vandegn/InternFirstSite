'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getPartnerUniversity } from '@/lib/supabase';

export default function StudentDashboard() {
  const [partnerLogo, setPartnerLogo] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPartner() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const partner = await getPartnerUniversity(user.email);
      if (partner) {
        setPartnerLogo(partner.logo_url);
        setPartnerName(partner.name);
      }
    }
    fetchPartner();
  }, []);

  return (
    <div className="dashboard-body">
      {/* Dashboard Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <Link href="/home" className="logo">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
          {partnerLogo && (
            <>
              <span className="logo-divider"></span>
              <img src={partnerLogo} alt={partnerName || 'University'} className="partner-logo" />
            </>
          )}
          <nav className="main-nav">
            <ul>
              <li><Link href="/dashboard/student" className="active">Student</Link></li>
              <li><Link href="/dashboard/employer">Employers</Link></li>
              <li><Link href="/dashboard/university">University</Link></li>
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
            <div className="dash-avatar">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png" alt="Ben Smith" />
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
            <Link href="/dashboard/student" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
              Internships
            </Link>
            <Link href="/dashboard/student" className="sidebar-link">
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
                <div className="stat-value">0</div>
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

          {/* Upcoming Events */}
          <div className="dash-section">
            <h3 className="dash-section-title">Upcoming Events</h3>
            <div className="event-list">
              <div className="event-item">
                <div className="event-dot blue"></div>
                <div className="event-info">
                  <strong>Career Fair - IT</strong>
                  <span>February 29, 2026</span>
                </div>
              </div>
              <div className="event-item">
                <div className="event-dot green"></div>
                <div className="event-info">
                  <strong>Career Fair - Law</strong>
                  <span>March 7, 2026</span>
                </div>
              </div>
              <div className="event-item">
                <div className="event-dot purple"></div>
                <div className="event-info">
                  <strong>Club Meeting</strong>
                  <span>March 28, 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Browse Internships - 2 listing cards */}
          <div className="dash-section">
            <h3 className="dash-section-title">Browse Internships</h3>
            <div className="listing-grid">
              {/* Card 1 */}
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/image.svg" alt="XYZ Company" className="listing-logo" />
                  <button className="bookmark-btn" aria-label="Bookmark">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
                <h4>Software Engineer - Frontend</h4>
                <p className="listing-company">XYZ Company</p>
                <p className="listing-location">California, USA</p>
                <div className="listing-tags">
                  <span>Direct Employment</span>
                  <span>Full time</span>
                  <span>Remote</span>
                  <span>2-4 Years</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-salary">$16-20/hr</span>
                  <span className="listing-time">an hour ago</span>
                </div>
                <span className="early-badge">Be an early applicant</span>
              </div>

              {/* Card 2 */}
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Icon.jpeg.svg" alt="XYZ Company" className="listing-logo" />
                  <button className="bookmark-btn" aria-label="Bookmark">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
                <h4>Product Manager</h4>
                <p className="listing-company">XYZ Company</p>
                <p className="listing-location">Texas, USA</p>
                <div className="listing-tags">
                  <span>Direct Employment</span>
                  <span>Full time</span>
                  <span>Remote</span>
                  <span>4-6 Years</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-salary">$16-20/hr</span>
                  <span className="listing-time">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>

          {/* My Events - 2 listing cards */}
          <div className="dash-section">
            <h3 className="dash-section-title">My Events</h3>
            <div className="listing-grid">
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/image.svg" alt="Career Fair" className="listing-logo" />
                </div>
                <h4>Career Fair - IT</h4>
                <p className="listing-company">On Campus</p>
                <p className="listing-location">Raleigh, USA</p>
                <div className="listing-tags">
                  <span>Vendors</span>
                  <span>Ambassadors</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-time">Feb 3, 2026</span>
                </div>
              </div>
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Icon.jpeg.svg" alt="Career Fair" className="listing-logo" />
                </div>
                <h4>Career Fair - Law</h4>
                <p className="listing-company">On Campus</p>
                <p className="listing-location">Raleigh, USA</p>
                <div className="listing-tags">
                  <span>Vendors</span>
                  <span>Ambassadors</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-time">Feb 2, 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resources - 3 resource cards */}
          <div className="dash-section">
            <h3 className="dash-section-title">Resources</h3>
            <div className="resource-grid">
              <div className="resource-card">
                <div className="resource-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <h4>Resume Advice</h4>
                <p>Get expert tips on crafting a standout resume that catches recruiters&apos; attention.</p>
              </div>
              <div className="resource-card">
                <div className="resource-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                </div>
                <h4>Live Interview Prep</h4>
                <p>Practice with real interview scenarios and get feedback to improve your performance.</p>
              </div>
              <div className="resource-card">
                <div className="resource-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h4>Career Coaching</h4>
                <p>One-on-one sessions with experienced career coaches to guide your professional journey.</p>
              </div>
            </div>
          </div>

          {/* News - 3 news cards */}
          <div className="dash-section">
            <h3 className="dash-section-title">News</h3>
            <div className="news-grid">
              <div className="news-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205.png" alt="News article" />
                <div className="news-body">
                  <div className="news-meta">
                    <span>Feb 15, 2026</span>
                    <span>Career Tips</span>
                  </div>
                  <h4>How to Land Your First Internship: A Complete Guide</h4>
                  <Link href="/blog">Read More</Link>
                </div>
              </div>
              <div className="news-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-1.png" alt="News article" />
                <div className="news-body">
                  <div className="news-meta">
                    <span>Feb 10, 2026</span>
                    <span>Industry News</span>
                  </div>
                  <h4>Top 10 Companies Hiring Interns This Spring</h4>
                  <Link href="/blog">Read More</Link>
                </div>
              </div>
              <div className="news-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-2.png" alt="News article" />
                <div className="news-body">
                  <div className="news-meta">
                    <span>Feb 5, 2026</span>
                    <span>Skills</span>
                  </div>
                  <h4>5 Skills Every Intern Needs to Succeed in 2026</h4>
                  <Link href="/blog">Read More</Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar - Profile */}
        <aside className="dash-profile">
          <div className="profile-card">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png" alt="Ben Smith" className="profile-avatar" />
            <h4>Ben Smith</h4>
            <p className="profile-email">bensmith@isu.edu</p>
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
