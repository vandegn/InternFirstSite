'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getActiveListings } from '@/lib/supabase';
import { INDUSTRIES } from '@/lib/constants';
import TestPostingBadge from '@/components/TestPostingBadge';
import Pagination from '@/components/Pagination';

type Listing = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  is_hybrid: boolean;
  compensation: string | null;
  industry: string;
  created_at: string;
  employers: {
    company_name: string;
    logo_url: string | null;
  };
};

const PAGE_SIZE = 24;

export default function PublicInternshipsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setCurrentPage(1);
  }, [industry, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getActiveListings(currentPage, PAGE_SIZE, {
        industry: industry || undefined,
        search: debouncedSearch || undefined,
      });
      if (!cancelled) {
        setListings(result.data as Listing[]);
        setTotalCount(result.totalCount);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [industry, debouncedSearch, currentPage]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function goToPage(page: number) {
    setCurrentPage(page);
  }

  const popularIndustries = useMemo(() => INDUSTRIES.slice(0, 10), []);

  return (
    <>
      <Header />

      {/* Hero */}
      <section className="hero" style={{ padding: '64px 0 32px' }}>
        <div className="container">
          <div className="hero-badge">Browse openly · no signup needed</div>
          <h1 style={{ fontSize: 44, maxWidth: 720 }}>Find your next internship</h1>
          <p className="hero-subtitle" style={{ marginBottom: 32 }}>
            Reviewed opportunities from real employers. Create an account only when you&apos;re ready to apply.
          </p>

          {/* Search + filter */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              maxWidth: 720,
              margin: '0 auto',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 320px' }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-secondary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search role, company, or skill..."
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 42px',
                  borderRadius: 10,
                  border: '1.5px solid var(--border)',
                  fontSize: 15,
                  background: 'var(--surface)',
                  outline: 'none',
                }}
              />
            </div>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                fontSize: 15,
                background: 'var(--surface)',
                minWidth: 200,
                cursor: 'pointer',
              }}
            >
              <option value="">All industries</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          {/* Industry chips */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              marginTop: 20,
              maxWidth: 800,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <button
              onClick={() => setIndustry('')}
              style={chipStyle(industry === '')}
            >
              All
            </button>
            {popularIndustries.map((i) => (
              <button key={i} onClick={() => setIndustry(i)} style={chipStyle(industry === i)}>
                {i}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Listings grid */}
      <section style={{ padding: '40px 0 80px', background: 'var(--bg)' }}>
        <div className="container">
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>
              Loading internships...
            </p>
          ) : listings.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                maxWidth: 560,
                margin: '0 auto',
              }}
            >
              <h3 style={{ fontSize: 20, color: 'var(--dark)', marginBottom: 8 }}>
                No internships found
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                {search || industry
                  ? 'No open internships match your search or filters right now. Try adjusting them.'
                  : 'There are no open internships at the moment. Check back soon.'}
              </p>
              {(search || industry) && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setIndustry(''); }}
                  className="btn-primary"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{(currentPage - 1) * PAGE_SIZE + listings.length} of {totalCount} {totalCount === 1 ? 'opportunity' : 'opportunities'}
              </p>
              <div className="internship-grid">
                {listings.map((l) => (
                  <article key={l.id} className="internship-card">
                    <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
                      {l.employers?.logo_url ? (
                        <img
                          src={l.employers.logo_url}
                          alt={l.employers.company_name}
                          style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                          }}
                        >
                          {l.employers?.company_name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: 'var(--dark)' }}>
                          {l.employers?.company_name ?? 'Employer'}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-light)', margin: 0 }}>
                          {l.industry}
                        </p>
                      </div>
                    </div>
                    <div className="internship-body">
                      <div style={{ marginBottom: '8px' }}><TestPostingBadge compact /></div>
                      <h3>{l.title}</h3>
                      <p className="location">
                        {l.is_remote
                          ? 'Remote'
                          : l.is_hybrid
                          ? `Hybrid${l.location ? ` · ${l.location}` : ''}`
                          : l.location || 'Location TBD'}
                      </p>
                      <div className="internship-meta">
                        {l.compensation && <span className="badge-salary">{l.compensation}</span>}
                        {(l.is_remote || l.is_hybrid) && (
                          <span className="badge-type">{l.is_remote ? 'Remote' : 'Hybrid'}</span>
                        )}
                      </div>
                      <Link href={`/internships/${l.id}`} className="btn-apply">
                        View role
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 999,
    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? 'var(--on-primary)' : 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };
}
