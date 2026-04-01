'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase, getActiveListings, trackListingView } from '@/lib/supabase';
import { INDUSTRIES } from '@/lib/constants';
import Pagination from '@/components/Pagination';
import ReactMarkdown from 'react-markdown';

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
  key_responsibilities: string | null;
  employers: {
    company_name: string;
    logo_url: string | null;
  };
};

const PAGE_SIZE = 20;

export default function BrowseInternships() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const viewedListingsRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);

  const selectListing = (id: string) => {
    setSelectedId(id);
    detailPanelRef.current?.scrollTo({ top: 0 });
    // Fire-and-forget view tracking, once per listing per session
    const uid = userIdRef.current;
    if (uid && !viewedListingsRef.current.has(id)) {
      viewedListingsRef.current.add(id);
      trackListingView(id, uid).catch(() => {});
    }
  };

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [workModeFilter, setWorkModeFilter] = useState<'all' | 'remote' | 'in-person' | 'hybrid'>('all');
  const [industryOpen, setIndustryOpen] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');
  const industryRef = useRef<HTMLDivElement>(null);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const salaryRef = useRef<HTMLDivElement>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (industryRef.current && !industryRef.current.contains(e.target as Node)) setIndustryOpen(false);
      if (salaryRef.current && !salaryRef.current.contains(e.target as Node)) setSalaryOpen(false);
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredIndustries = useMemo(() => {
    if (!industrySearch.trim()) return INDUSTRIES;
    const q = industrySearch.toLowerCase();
    return INDUSTRIES.filter((ind) => ind.toLowerCase().includes(q));
  }, [industrySearch]);

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      const result = await getActiveListings(currentPage, PAGE_SIZE, selectedIndustry || undefined);
      setListings(result.data as Listing[]);
      setTotalCount(result.totalCount);
      setLoading(false);
    }
    fetchListings();
  }, [currentPage, selectedIndustry]);

  // Auto-select first listing when listings change
  useEffect(() => {
    if (listings.length > 0 && !selectedId) {
      const firstId = listings[0].id;
      setSelectedId(firstId);
      // Track view for auto-selected listing
      const uid = userIdRef.current;
      if (uid && !viewedListingsRef.current.has(firstId)) {
        viewedListingsRef.current.add(firstId);
        trackListingView(firstId, uid).catch(() => {});
      }
    }
  }, [listings, selectedId]);

  // Client-side filtering for search, location, paid, work mode
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

  const selectStyle: React.CSSProperties = {
    padding: '8px 32px 8px 12px',
    borderRadius: '8px',
    border: '1.5px solid var(--border)',
    fontSize: '0.82rem',
    fontWeight: 500,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    transition: 'border-color 0.15s ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Compact filter toolbar */}
      <div style={{
        padding: '12px 24px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search role, company, or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              fontSize: '0.85rem',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Location input */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <input
            type="text"
            placeholder="Location..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{
              padding: '8px 12px 8px 32px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              fontSize: '0.82rem',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              width: '140px',
              transition: 'border-color 0.15s ease',
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }} />

        {/* Salary dropdown */}
        <div ref={salaryRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => { setSalaryOpen(!salaryOpen); setModeOpen(false); setIndustryOpen(false); }}
            style={{
              ...selectStyle,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: paidFilter !== 'all' ? 600 : 500,
              borderColor: salaryOpen ? 'var(--primary)' : 'var(--border)',
            }}
          >
            {paidFilter === 'all' ? 'Any Salary' : paidFilter === 'paid' ? 'Paid' : 'Unpaid'}
          </button>
          {salaryOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: '140px',
              background: '#fff',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              zIndex: 100,
              overflow: 'hidden',
              padding: '4px 0',
            }}>
              {([['all', 'Any Salary'], ['paid', 'Paid'], ['unpaid', 'Unpaid']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setPaidFilter(val); setSalaryOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '7px 12px',
                    border: 'none',
                    background: paidFilter === val ? 'var(--primary-light)' : 'transparent',
                    color: paidFilter === val ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: paidFilter === val ? 600 : 400,
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { if (paidFilter !== val) e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={(e) => { if (paidFilter !== val) e.currentTarget.style.background = 'transparent'; }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Work mode dropdown */}
        <div ref={modeRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => { setModeOpen(!modeOpen); setSalaryOpen(false); setIndustryOpen(false); }}
            style={{
              ...selectStyle,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: workModeFilter !== 'all' ? 600 : 500,
              borderColor: modeOpen ? 'var(--primary)' : 'var(--border)',
            }}
          >
            {workModeFilter === 'all' ? 'Any Mode' : workModeFilter === 'remote' ? 'Remote' : 'In-Person'}
          </button>
          {modeOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: '140px',
              background: '#fff',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              zIndex: 100,
              overflow: 'hidden',
              padding: '4px 0',
            }}>
              {([['all', 'Any Mode'], ['remote', 'Remote'], ['in-person', 'In-Person']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setWorkModeFilter(val as typeof workModeFilter); setModeOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '7px 12px',
                    border: 'none',
                    background: workModeFilter === val ? 'var(--primary-light)' : 'transparent',
                    color: workModeFilter === val ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: workModeFilter === val ? 600 : 400,
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { if (workModeFilter !== val) e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={(e) => { if (workModeFilter !== val) e.currentTarget.style.background = 'transparent'; }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Industry searchable dropdown */}
        <div ref={industryRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => { setIndustryOpen(!industryOpen); setIndustrySearch(''); setSalaryOpen(false); setModeOpen(false); }}
            style={{
              ...selectStyle,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: selectedIndustry ? 600 : 500,
              borderColor: industryOpen ? 'var(--primary)' : 'var(--border)',
            }}
          >
            {selectedIndustry || 'All Industries'}
          </button>

          {industryOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '220px',
              background: '#fff',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              zIndex: 100,
              overflow: 'hidden',
            }}>
              {/* Search input */}
              <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ position: 'relative' }}>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}
                  >
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search industries..."
                    value={industrySearch}
                    onChange={(e) => setIndustrySearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '7px 8px 7px 28px',
                      border: '1.5px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      background: 'var(--bg)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Options list */}
              <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px 0' }}>
                <button
                  onClick={() => { handleIndustryFilter(''); setIndustryOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '7px 12px',
                    border: 'none',
                    background: selectedIndustry === '' ? 'var(--primary-light)' : 'transparent',
                    color: selectedIndustry === '' ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: selectedIndustry === '' ? 600 : 400,
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { if (selectedIndustry !== '') e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={(e) => { if (selectedIndustry !== '') e.currentTarget.style.background = 'transparent'; }}
                >
                  All Industries
                </button>
                {filteredIndustries.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => { handleIndustryFilter(ind); setIndustryOpen(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '7px 12px',
                      border: 'none',
                      background: selectedIndustry === ind ? 'var(--primary-light)' : 'transparent',
                      color: selectedIndustry === ind ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: selectedIndustry === ind ? 600 : 400,
                      fontSize: '0.82rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => { if (selectedIndustry !== ind) e.currentTarget.style.background = 'var(--bg)'; }}
                    onMouseLeave={(e) => { if (selectedIndustry !== ind) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {ind}
                  </button>
                ))}
                {filteredIndustries.length === 0 && (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    No matching industries
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split view */}
      {loading ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>Loading internships...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No internships found</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left panel - filters + listing cards */}
          <div
            style={{
              width: '35%',
              minWidth: '300px',
              maxWidth: '380px',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                onClick={() => selectListing(listing.id)}
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
                  {/* Company logo or initial */}
                  {listing.employers?.logo_url ? (
                    <img
                      src={listing.employers.logo_url}
                      alt={listing.employers.company_name}
                      style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: selectedId === listing.id ? 'var(--primary)' : 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: selectedId === listing.id ? '#fff' : 'var(--primary)',
                        fontSize: '1rem',
                        flexShrink: 0,
                      }}
                    >
                      {listing.employers?.company_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        margin: '0 0 2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-primary)',
                      }}
                    >
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

            </div>

            {/* Pagination pinned at bottom */}
            {totalPages > 1 && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => { setCurrentPage(p); setSelectedId(null); }} />
              </div>
            )}
          </div>

          {/* Right panel - selected listing detail */}
          <div
            ref={detailPanelRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 28px',
              background: 'var(--bg)',
            }}
          >
            {selectedListing ? (
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                  {selectedListing.employers?.logo_url ? (
                    <img
                      src={selectedListing.employers.logo_url}
                      alt={selectedListing.employers.company_name}
                      style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        background: 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        fontSize: '1.4rem',
                        flexShrink: 0,
                      }}
                    >
                      {selectedListing.employers?.company_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px' }}>
                      {selectedListing.title}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
                      {selectedListing.employers?.company_name}
                    </p>
                  </div>
                </div>

                {/* Meta tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                  {selectedListing.location && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.82rem', color: 'var(--text-secondary)',
                      padding: '5px 12px', borderRadius: '6px',
                      background: 'var(--bg-secondary, #f5f5f5)',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {selectedListing.location}
                    </span>
                  )}
                  {selectedListing.is_remote && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.82rem', color: 'var(--text-secondary)',
                      padding: '5px 12px', borderRadius: '6px',
                      background: 'var(--bg-secondary, #f5f5f5)',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                      Remote
                    </span>
                  )}
                  {selectedListing.compensation && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 500,
                      padding: '5px 12px', borderRadius: '6px',
                      background: 'var(--primary-light)',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                      {selectedListing.compensation}
                    </span>
                  )}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.82rem', color: 'var(--text-secondary)',
                    padding: '5px 12px', borderRadius: '6px',
                    background: 'var(--bg-secondary, #f5f5f5)',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                    {selectedListing.industry}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.82rem', color: 'var(--text-secondary)',
                    padding: '5px 12px', borderRadius: '6px',
                    background: 'var(--bg-secondary, #f5f5f5)',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    Posted {new Date(selectedListing.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Apply button */}
                <div style={{ marginBottom: '24px' }}>
                  <Link
                    href={`/dashboard/student/internships/${selectedListing.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '11px 28px',
                      borderRadius: '10px',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      textDecoration: 'none',
                      transition: 'var(--transition)',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    Apply Now
                  </Link>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 24px' }} />

                {/* Qualifications */}
                {selectedListing.requirements && (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                      Qualifications
                    </h3>
                    <div className="markdown-content">
                      <ReactMarkdown>{selectedListing.requirements}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Job Overview */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                    Job Overview
                  </h3>
                  <div className="markdown-content">
                    <ReactMarkdown>{selectedListing.description}</ReactMarkdown>
                  </div>
                </div>

                {/* Key Responsibilities */}
                {selectedListing.key_responsibilities && (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                      Key Responsibilities
                    </h3>
                    <div className="markdown-content">
                      <ReactMarkdown>{selectedListing.key_responsibilities || ''}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Company overview */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                    Company Overview
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'var(--bg-secondary, #f9fafb)',
                    border: '1px solid var(--border)',
                  }}>
                    {selectedListing.employers?.logo_url ? (
                      <img
                        src={selectedListing.employers.logo_url}
                        alt={selectedListing.employers.company_name}
                        style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: 8,
                        background: 'var(--primary-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, color: 'var(--primary)', fontSize: '1rem',
                      }}>
                        {selectedListing.employers?.company_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.92rem', margin: 0 }}>
                        {selectedListing.employers?.company_name}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        {selectedListing.industry}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom apply CTA */}
                <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 20px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Link
                    href={`/dashboard/student/internships/${selectedListing.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '11px 28px',
                      borderRadius: '10px',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      textDecoration: 'none',
                      transition: 'var(--transition)',
                    }}
                  >
                    Apply Now
                  </Link>
                  <Link
                    href={`/dashboard/student/internships/${selectedListing.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '11px 20px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      transition: 'var(--transition)',
                    }}
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
