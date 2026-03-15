'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getActiveListings } from '@/lib/supabase';
import Pagination from '@/components/Pagination';

type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  requirements: string | null;
  created_at: string;
  employers: {
    company_name: string;
    logo_url: string | null;
  };
};

const PAGE_SIZE = 10;

export default function BrowseInternships() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const result = await getActiveListings(currentPage, PAGE_SIZE);
      setListings(result.data as Listing[]);
      setTotalCount(result.totalCount);
      setLoading(false);
    }
    fetchListings();
  }, [currentPage]);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Browse Internships</h2>
        <Link href="/dashboard/student" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}>
          Back to Dashboard
        </Link>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading internships...</p>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No internships available yet</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Check back soon for new opportunities!</p>
        </div>
      ) : (
        <>
          <div className="listing-grid">
            {listings.map((listing) => (
              <Link
                href={`/dashboard/student/internships/${listing.id}`}
                key={listing.id}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="listing-card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}>
                  <div className="listing-header">
                    {listing.employers?.logo_url ? (
                      <img src={listing.employers.logo_url} alt={listing.employers.company_name} className="listing-logo" />
                    ) : (
                      <div className="listing-logo" style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
                        {listing.employers?.company_name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <h4>{listing.title}</h4>
                  <p className="listing-company">{listing.employers?.company_name}</p>
                  <p className="listing-location">{listing.location || 'Location not specified'}</p>
                  <div className="listing-tags">
                    {listing.is_remote && <span>Remote</span>}
                    {listing.location && !listing.is_remote && <span>On-site</span>}
                  </div>
                  <div className="listing-footer">
                    <span className="listing-salary">{listing.compensation || 'TBD'}</span>
                    <span className="listing-time">{timeAgo(listing.created_at)}</span>
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
  );
}
