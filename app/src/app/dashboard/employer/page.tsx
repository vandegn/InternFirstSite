import Link from 'next/link';

export default function EmployerDashboard() {
  return (
    <div className="dashboard-body">
      {/* Dashboard Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <Link href="/" className="logo">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
          <nav className="main-nav">
            <ul>
              <li><Link href="/dashboard/student">Student</Link></li>
              <li><Link href="/dashboard/employer" className="active">Employers</Link></li>
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
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png" alt="Profile" />
            </div>
          </div>
        </div>
      </header>

      <div className="dash-layout">
        {/* Sidebar */}
        <aside className="dash-sidebar">
          <nav className="sidebar-nav">
            <Link href="/dashboard/employer" className="sidebar-link active">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home
            </Link>
            <Link href="/dashboard/employer/listings" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              My Listings
            </Link>
            <Link href="/dashboard/employer/events" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              My Events
            </Link>
            <Link href="/dashboard/employer/inbox" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              My Inbox
            </Link>
            <Link href="/dashboard/employer/connect" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Connect
            </Link>
            <Link href="/dashboard/employer/news" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/><path d="M21 12a9 9 0 0 1-9 9"/><path d="M21 8v4h-4"/><line x1="3" y1="10" x2="15" y2="10"/><line x1="3" y1="14" x2="12" y2="14"/></svg>
              News
            </Link>
            <Link href="/dashboard/employer/resources" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              Resources
            </Link>
            <div className="sidebar-divider"></div>
            <Link href="/dashboard/employer/settings" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Settings
            </Link>
            <Link href="/dashboard/employer/help" className="sidebar-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Help Center
            </Link>
          </nav>
        </aside>

        <main className="dash-main">
          {/* Upcoming Interviews */}
          <div className="dash-section">
            <h3 className="dash-section-title">Upcoming Interviews</h3>
            <div className="event-list">
              <div className="event-item">
                <div className="event-dot blue"></div>
                <div className="event-info">
                  <strong>Jonah Keshguerian</strong>
                  <span>March 3, 2026</span>
                </div>
              </div>
              <div className="event-item">
                <div className="event-dot green"></div>
                <div className="event-info">
                  <strong>Ben Smith</strong>
                  <span>March 7, 2026</span>
                </div>
              </div>
              <div className="event-item">
                <div className="event-dot purple"></div>
                <div className="event-info">
                  <strong>Max Van Dessel</strong>
                  <span>March 10, 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats - 4 column */}
          <div className="dash-stats four-col">
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
              <div>
                <div className="stat-label">Active Listings</div>
                <div className="stat-value">0</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div className="stat-label">Total Applicants</div>
                <div className="stat-value">0</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div>
                <div className="stat-label">Interviews</div>
                <div className="stat-value">0</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div>
                <div className="stat-label">Impressions</div>
                <div className="stat-value">0</div>
              </div>
            </div>
          </div>

          {/* My Listings */}
          <div className="dash-section">
            <h3 className="dash-section-title">My Listings</h3>
            <div className="listing-grid">
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png" alt="XYZ Company" className="listing-logo" />
                  <button className="bookmark-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
                <h4>Software Engineer - Frontend</h4>
                <p className="listing-company">XYZ Company</p>
                <p className="listing-location">Raleigh, USA</p>
                <div className="listing-tags">
                  <span>Full-Time</span>
                  <span>Remote</span>
                  <span>React</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-salary">$20/hr</span>
                  <span className="listing-time">Posted 2 days ago</span>
                </div>
              </div>
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png" alt="XYZ Company" className="listing-logo" />
                  <button className="bookmark-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
                <h4>Product Manager</h4>
                <p className="listing-company">XYZ Company</p>
                <p className="listing-location">Raleigh, USA</p>
                <div className="listing-tags">
                  <span>Full-Time</span>
                  <span>On-site</span>
                  <span>Management</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-salary">$22/hr</span>
                  <span className="listing-time">Posted 5 days ago</span>
                </div>
              </div>
            </div>
          </div>

          {/* My Events */}
          <div className="dash-section">
            <h3 className="dash-section-title">My Events</h3>
            <div className="listing-grid">
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png" alt="Career Fair" className="listing-logo" />
                  <button className="bookmark-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
                <h4>Career Fair - IT</h4>
                <p className="listing-company">On Campus</p>
                <p className="listing-location">Raleigh, USA</p>
                <div className="listing-tags">
                  <span>Networking</span>
                  <span>IT</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-salary">Free</span>
                  <span className="listing-time">Mar 7, 2026</span>
                </div>
              </div>
              <div className="listing-card">
                <div className="listing-header">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Image-2.png" alt="Career Fair" className="listing-logo" />
                  <button className="bookmark-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
                <h4>Career Fair - Law</h4>
                <p className="listing-company">On Campus</p>
                <p className="listing-location">Raleigh, USA</p>
                <div className="listing-tags">
                  <span>Networking</span>
                  <span>Law</span>
                </div>
                <div className="listing-footer">
                  <span className="listing-salary">Free</span>
                  <span className="listing-time">Mar 14, 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="dash-section">
            <h3 className="dash-section-title">Statistics</h3>
            <div className="dash-stats">
              <div className="stat-card">
                <div className="stat-icon blue">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <div>
                  <div className="stat-label">Views</div>
                  <div className="stat-value">0</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                </div>
                <div>
                  <div className="stat-label">Clicks</div>
                  <div className="stat-value">0</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <div className="stat-label">Applications</div>
                  <div className="stat-value">0</div>
                </div>
              </div>
            </div>
          </div>

          {/* My Candidates */}
          <div className="dash-section">
            <h3 className="dash-section-title">My Candidates</h3>
            <div className="candidate-grid">
              <div className="candidate-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png" alt="Jonah" className="candidate-avatar" />
                <h4>Jonah Keshguerian</h4>
                <p>Applied for: Software Engineer</p>
                <div className="match-badge">98% Match</div>
              </div>
              <div className="candidate-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png" alt="Ben" className="candidate-avatar" />
                <h4>Ben Smith</h4>
                <p>Applied for: Product Manager</p>
                <div className="match-badge">94% Match</div>
              </div>
              <div className="candidate-card">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png" alt="Luke" className="candidate-avatar" />
                <h4>Luke Baltzell</h4>
                <p>Applied for: Software Engineer</p>
                <div className="match-badge">87% Match</div>
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

        {/* Right sidebar - Employer profile */}
        <aside className="dash-profile">
          <div className="profile-card">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png" alt="Max Van Dessel" className="profile-avatar" />
            <h4>Max Van Dessel</h4>
            <p className="profile-email">maxvand@gmail.com</p>
            <div className="profile-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '100%' }}></div>
              </div>
              <span>100% Complete</span>
            </div>
            <ul className="profile-checklist">
              <li className="checked">Company Info</li>
              <li className="checked">List a Job</li>
              <li className="checked">Message Applicant</li>
              <li className="checked">Hire Applicant</li>
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
                <span>Hiring Status</span>
                <strong className="status-green">Open to hire</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
