'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getEmployerByUserId, getEmployerListings, getProfile, getEmployerStats, getEmployerApplications } from '@/lib/supabase';
import Pagination from '@/components/Pagination';

type Listing = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  status: string;
  industry: string;
  created_at: string;
};

const PAGE_SIZE = 10;

export default function EmployerDashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [interviewCount, setInterviewCount] = useState(0);
  const [recentCandidates, setRecentCandidates] = useState<any[]>([]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const [employerId, setEmployerId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEmployer() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;

      setCompanyName(employer.company_name);
      setEmployerId(employer.id);

      const [stats, apps] = await Promise.all([
        getEmployerStats(employer.id),
        getEmployerApplications(employer.id),
      ]);
      setTotalApplicants(stats.totalApplicants);
      setInterviewCount(stats.interviewing);
      setRecentCandidates(apps.slice(0, 3));
    }
    fetchEmployer();
  }, []);

  useEffect(() => {
    if (!employerId) return;
    async function fetchListings() {
      setLoading(true);
      const result = await getEmployerListings(employerId!, currentPage, PAGE_SIZE);
      setListings(result.data);
      setTotalCount(result.totalCount);
      setActiveCount(result.data.filter(l => l.status === 'active').length);
      setLoading(false);
    }
    fetchListings();
  }, [employerId, currentPage]);

  return (
    <div className="dash-main">
      {/* Stats - 4 column */}
      <div className="dash-stats four-col">
        <div className="stat-card">
          <div className="stat-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div>
            <div className="stat-label">Active Listings</div>
            <div className="stat-value">{activeCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <div className="stat-label">Total Applicants</div>
            <div className="stat-value">{totalApplicants}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <div>
            <div className="stat-label">Interviews</div>
            <div className="stat-value">{interviewCount}</div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="dash-section-title">My Listings</h3>
          <Link href="/dashboard/employer/listings/new" className="btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
            + Post New Listing
          </Link>
        </div>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        ) : listings.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
            No listings yet. Post your first internship!
          </p>
        ) : (
          <>
            <div className="listing-grid">
              {listings.map((listing) => (
                <Link href={`/dashboard/employer/listings/${listing.id}/edit`} key={listing.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="listing-card" style={{ cursor: 'pointer' }}>
                    <div className="listing-header">
                      <div className="listing-logo" style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                        {companyName.charAt(0)}
                      </div>
                    </div>
                    <h4>{listing.title}</h4>
                    <p className="listing-company">{companyName}</p>
                    <p className="listing-location">{listing.location || 'Not specified'}</p>
                    <div className="listing-tags">
                      <span>{listing.industry}</span>
                      <span style={listing.status === 'closed' ? { background: '#fee2e2', color: '#991b1b' } : undefined}>{listing.status === 'active' ? 'Active' : 'Closed'}</span>
                      {listing.is_remote && <span>Remote</span>}
                    </div>
                    <div className="listing-footer">
                      <span className="listing-salary">{listing.compensation || 'TBD'}</span>
                      <span className="listing-time">{new Date(listing.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </>
        )}
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
              <div className="stat-value">{totalApplicants}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Candidates */}
      <div className="dash-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="dash-section-title">Recent Candidates</h3>
          {recentCandidates.length > 0 && (
            <Link href="/dashboard/employer/applications" style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500 }}>
              View All &rarr;
            </Link>
          )}
        </div>
        {recentCandidates.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
            No applicants yet. Candidates will appear here when students apply.
          </p>
        ) : (
          <div className="candidate-grid">
            {recentCandidates.map((app: any) => (
              <Link href="/dashboard/employer/applications" key={app.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="candidate-card" style={{ cursor: 'pointer' }}>
                  <img
                    src={app.student?.profile?.avatar_url || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                    alt={app.student?.profile?.full_name || 'Applicant'}
                    className="candidate-avatar"
                  />
                  <h4>{app.student?.profile?.full_name || 'Unknown'}</h4>
                  <p>Applied for: {app.listing?.title || 'Unknown'}</p>
                  <div className="match-badge" style={{
                    background: app.status === 'offered' ? '#d1fae5' : app.status === 'interviewing' ? '#dbeafe' : app.status === 'rejected' ? '#fee2e2' : undefined,
                    color: app.status === 'offered' ? '#065f46' : app.status === 'interviewing' ? '#1e40af' : app.status === 'rejected' ? '#991b1b' : undefined,
                  }}>
                    {app.status === 'applied' ? 'New' : app.status === 'reviewed' ? 'Under Review' : app.status === 'interviewing' ? 'Interviewing' : app.status === 'offered' ? 'Offered' : 'Not Selected'}
                  </div>
                </div>
              </Link>
            ))}
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
    </div>
  );
}
