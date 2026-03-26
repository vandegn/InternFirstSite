'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase, getStudentByUserId, getUniversityPartnerListings } from '@/lib/supabase';
import { INDUSTRIES } from '@/lib/constants';
import Pagination from '@/components/Pagination';

type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  requirements: string | null;
  industry: string;
  created_at: string;
  employers: {
    company_name: string;
    logo_url: string | null;
  };
};

interface UniversityInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

const PAGE_SIZE = 20;

export default function SchoolJobs() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [university, setUniversity] = useState<UniversityInfo | null>(null);
  const [noUniversity, setNoUniversity] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Client-side filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [workModeFilter, setWorkModeFilter] = useState<'all' | 'remote' | 'in-person'>('all');

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get student's university
      const student = await getStudentByUserId(user.id);
      if (!student?.university_id) {
        setNoUniversity(true);
        setLoading(false);
        return;
      }

      // Fetch university info
      const { data: uniData } = await supabase
        .from('universities')
        .select('id, name, logo_url')
        .eq('id', student.university_id)
        .single();
      if (uniData) setUniversity(uniData);

      // Fetch partner listings
      const result = await getUniversityPartnerListings(
        student.university_id,
        currentPage,
        PAGE_SIZE,
        selectedIndustry || undefined
      );
      setListings(result.data as Listing[]);
      setTotalCount(result.totalCount);
      setLoading(false);
    }
    fetchData();
  }, [currentPage, selectedIndustry]);

  // Auto-select first listing when listings change
  useEffect(() => {
    if (listings.length > 0 && !selectedId) {
      setSelectedId(listings[0].id);
    }
  }, [listings, selectedId]);

  // Client-side filtering
  const filteredListings = useMemo(() => {
    let result = listings;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.employers?.company_name?.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          (l.requirements && l.requirements.toLowerCase().includes(q))
      );
    }

    if (locationFilter.trim()) {
      const loc = locationFilter.toLowerCase();
      result = result.filter(
        (l) => l.location && l.location.toLowerCase().includes(loc)
      );
    }

    if (paidFilter === 'paid') {
      result = result.filter(
        (l) => l.compensation && !l.compensation.toLowerCase().includes('unpaid')
      );
    } else if (paidFilter === 'unpaid') {
      result = result.filter(
        (l) => !l.compensation || l.compensation.toLowerCase().includes('unpaid')
      );
    }

    if (workModeFilter === 'remote') {
      result = result.filter((l) => l.is_remote);
    } else if (workModeFilter === 'in-person') {
      result = result.filter((l) => !l.is_remote && l.location);
    }

    return result;
  }, [listings, searchQuery, locationFilter, paidFilter, workModeFilter]);

  const selectedListing = filteredListings.find((l) => l.id === selectedId) || null;

  function handleIndustryFilter(industry: string) {
    setSelectedIndustry(industry);
    setCurrentPage(1);
    setSelectedId(null);
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
    background: active ? 'var(--primary)' : 'var(--primary-light)',
    color: active ? '#fff' : 'var(--primary)',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  });

  // No university affiliated
  if (!loading && noUniversity) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>School Job Portal</h2>
          <Link href="/dashboard/student" style={{ fontSize: '0.82rem', padding: '7px 14px', textDecoration: 'none', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Back to Dashboard
          </Link>
        </div>
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No university affiliation found</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Update your profile with your university to see school-affiliated job listings.</p>
          <Link href="/dashboard/student/settings" className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px', marginTop: '20px', textDecoration: 'none', fontSize: '0.9rem' }}>
            Update Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 64px)' }}>
      {/* Top bar */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        {/* Header with university branding */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {university?.logo_url ? (
              <img
                src={university.logo_url}
                alt={`${university.name} logo`}
                style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'contain', border: '1px solid var(--border)', background: '#fff', padding: '3px' }}
              />
            ) : (
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
                {university?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                {university ? `${university.name} Job Portal` : 'School Job Portal'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '2px 0 0' }}>
                Exclusive opportunities from your university&apos;s employer partners
              </p>
            </div>
          </div>
          <Link href="/dashboard/student" style={{ fontSize: '0.82rem', padding: '7px 14px', textDecoration: 'none', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 500, transition: 'var(--transition)' }}>
            Back to Dashboard
          </Link>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by role, company, or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '11px 16px 11px 42px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.9rem', background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none', transition: 'var(--transition)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Filter by location..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.82rem', background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none', width: '160px', transition: 'var(--transition)' }}
          />
          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
          {(['all', 'paid', 'unpaid'] as const).map((val) => (
            <button key={val} onClick={() => setPaidFilter(val)} style={pillStyle(paidFilter === val)}>
              {val === 'all' ? 'Any Pay' : val === 'paid' ? 'Paid' : 'Unpaid'}
            </button>
          ))}
          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
          {(['all', 'remote', 'in-person'] as const).map((val) => (
            <button key={val} onClick={() => setWorkModeFilter(val)} style={pillStyle(workModeFilter === val)}>
              {val === 'all' ? 'Any Mode' : val === 'remote' ? 'Remote' : 'In-Person'}
            </button>
          ))}
        </div>

        {/* Industry pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => handleIndustryFilter('')} style={pillStyle(selectedIndustry === '')}>
            All Industries
          </button>
          {INDUSTRIES.map((ind) => (
            <button key={ind} onClick={() => handleIndustryFilter(ind)} style={pillStyle(selectedIndustry === ind)}>
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Split view */}
      {loading ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Loading partner listings...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No partner listings found</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
            {listings.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Your university is building employer partnerships. Check back soon!'}
          </p>
          <Link href="/dashboard/student/internships" className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px', marginTop: '20px', textDecoration: 'none', fontSize: '0.9rem' }}>
            Browse All Internships
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left panel - listing cards */}
          <div style={{ width: '40%', minWidth: '320px', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '0' }}>
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                onClick={() => setSelectedId(listing.id)}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: selectedId === listing.id ? 'var(--primary-light)' : 'transparent',
                  borderLeft: selectedId === listing.id ? '3px solid var(--primary)' : '3px solid transparent',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {listing.employers?.logo_url ? (
                    <img src={listing.employers.logo_url} alt={listing.employers.company_name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: selectedId === listing.id ? 'var(--primary)' : 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: selectedId === listing.id ? '#fff' : 'var(--primary)', fontSize: '1rem', flexShrink: 0 }}>
                      {listing.employers?.company_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {listing.title}
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                      {listing.employers?.company_name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        {listing.is_remote ? 'Remote' : listing.location || 'Not specified'}
                      </span>
                      {listing.compensation && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 500 }}>
                          {listing.compensation}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '2px' }}>
                    {timeAgo(listing.created_at)}
                  </span>
                </div>
              </div>
            ))}

            {/* Pagination inside left panel */}
            {totalPages > 1 && (
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => { setCurrentPage(p); setSelectedId(null); }} />
              </div>
            )}
          </div>

          {/* Right panel - selected listing detail */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--bg)' }}>
            {selectedListing ? (
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                  {selectedListing.employers?.logo_url ? (
                    <img src={selectedListing.employers.logo_url} alt={selectedListing.employers.company_name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1.4rem', flexShrink: 0 }}>
                      {selectedListing.employers?.company_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px' }}>{selectedListing.title}</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>{selectedListing.employers?.company_name}</p>
                  </div>
                </div>

                {/* Meta tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                  {selectedListing.location && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '5px 12px', borderRadius: '6px', background: 'var(--bg-secondary, #f5f5f5)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {selectedListing.location}
                    </span>
                  )}
                  {selectedListing.is_remote && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '5px 12px', borderRadius: '6px', background: 'var(--bg-secondary, #f5f5f5)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                      Remote
                    </span>
                  )}
                  {selectedListing.compensation && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 500, padding: '5px 12px', borderRadius: '6px', background: 'var(--primary-light)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                      {selectedListing.compensation}
                    </span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '5px 12px', borderRadius: '6px', background: 'var(--bg-secondary, #f5f5f5)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                    {selectedListing.industry}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '5px 12px', borderRadius: '6px', background: 'var(--bg-secondary, #f5f5f5)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    Posted {new Date(selectedListing.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Apply button */}
                <div style={{ marginBottom: '24px' }}>
                  <Link
                    href={`/dashboard/student/internships/${selectedListing.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 28px', borderRadius: '10px', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.92rem', textDecoration: 'none', transition: 'var(--transition)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    Apply Now
                  </Link>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 24px' }} />

                {/* Description */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>About This Role</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.9rem', margin: 0 }}>
                    {selectedListing.description}
                  </p>
                </div>

                {/* Requirements */}
                {selectedListing.requirements && (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>Requirements</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.9rem', margin: 0 }}>
                      {selectedListing.requirements}
                    </p>
                  </div>
                )}

                {/* Company overview */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>Company Overview</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary, #f9fafb)', border: '1px solid var(--border)' }}>
                    {selectedListing.employers?.logo_url ? (
                      <img src={selectedListing.employers.logo_url} alt={selectedListing.employers.company_name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>
                        {selectedListing.employers?.company_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.92rem', margin: 0 }}>{selectedListing.employers?.company_name}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{selectedListing.industry}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom apply CTA */}
                <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 20px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Link
                    href={`/dashboard/student/internships/${selectedListing.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 28px', borderRadius: '10px', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.92rem', textDecoration: 'none', transition: 'var(--transition)' }}
                  >
                    Apply Now
                  </Link>
                  <Link
                    href={`/dashboard/student/internships/${selectedListing.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '11px 20px', borderRadius: '10px', border: '1.5px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', textDecoration: 'none', transition: 'var(--transition)' }}
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <div style={{ textAlign: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.4 }}>
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
                  </svg>
                  <p style={{ fontSize: '0.95rem' }}>Select a listing to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
