'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  supabase, getActiveListings, trackListingView, getListingSections,
  getStudentByUserId, getSavedListingIds, saveListing, unsaveListing,
  type ListingSection,
} from '@/lib/supabase';
import { INDUSTRIES, DURATIONS, splitCompensation } from '@/lib/constants';
import Pagination from '@/components/Pagination';
import ListingCustomBlocks, { ListingBanner, RoleTagPills } from '@/components/ListingCustomBlocks';
import { ListingCoreSectionsView } from '@/components/ListingCoreSections';

type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  is_hybrid: boolean;
  compensation: string | null;
  requirements: string | null;
  industry: string;
  created_at: string;
  application_deadline: string | null;
  key_responsibilities: string | null;
  section_order: string[] | null;
  preferred_skills: string[] | null;
  duration: string | null;
  role_tags: string[] | null;
  banner_url: string | null;
  accent_color: string | null;
  employers: {
    company_name: string;
    logo_url: string | null;
  };
};

function formatDeadline(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deadlineState(dateStr: string | null): 'expired' | 'soon' | 'normal' | null {
  if (!dateStr) return null;
  const deadline = new Date(dateStr).getTime();
  const now = Date.now();
  const daysLeft = (deadline - now) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 7) return 'soon';
  return 'normal';
}

const PAGE_SIZE = 20;

export default function BrowseInternships() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Custom sections for the listing shown in the detail pane, loaded on select.
  const [selectedSections, setSelectedSections] = useState<ListingSection[]>([]);
  const sectionsRequestRef = useRef<string | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const viewedListingsRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);

  const selectListing = (id: string) => {
    setSelectedId(id);
    setSelectedSections([]);
    // Ignore a slow response if the user has already picked another listing.
    sectionsRequestRef.current = id;
    getListingSections(id).then((sections) => {
      if (sectionsRequestRef.current === id) setSelectedSections(sections);
    });
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [workModeFilter, setWorkModeFilter] = useState<'all' | 'remote' | 'in-person' | 'hybrid'>('all');
  const [durationFilter, setDurationFilter] = useState<string>('');
  const [industryOpen, setIndustryOpen] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');
  const industryRef = useRef<HTMLDivElement>(null);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const salaryRef = useRef<HTMLDivElement>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);
  const [durationOpen, setDurationOpen] = useState(false);
  const durationRef = useRef<HTMLDivElement>(null);

  // Saved (bookmarked) listings. Held as a Set for O(1) lookups while
  // rendering every card; savedIdsLoaded gates the first fetch so the
  // "Saved" filter doesn't briefly show an empty list.
  const [studentId, setStudentId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedIdsLoaded, setSavedIdsLoaded] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Debounce search and location to avoid spamming the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(locationFilter), 300);
    return () => clearTimeout(t);
  }, [locationFilter]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (industryRef.current && !industryRef.current.contains(e.target as Node)) setIndustryOpen(false);
      if (salaryRef.current && !salaryRef.current.contains(e.target as Node)) setSalaryOpen(false);
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
      if (durationRef.current && !durationRef.current.contains(e.target as Node)) setDurationOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredIndustries = useMemo(() => {
    if (!industrySearch.trim()) return INDUSTRIES;
    const q = industrySearch.toLowerCase();
    return INDUSTRIES.filter((ind) => ind.toLowerCase().includes(q));
  }, [industrySearch]);

  // Reset to page 1 when any filter changes (so we don't request a page that no longer exists)
  useEffect(() => {
    setCurrentPage(1);
    setSelectedId(null);
  }, [debouncedSearch, debouncedLocation, paidFilter, workModeFilter, durationFilter, selectedIndustry, savedOnly]);

  // Bookmarks load once; toggling a card updates the set locally afterwards.
  useEffect(() => {
    async function fetchSaved() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const student = await getStudentByUserId(user.id);
      if (student) {
        setStudentId(student.id);
        setSavedIds(new Set(await getSavedListingIds(student.id)));
      }
      setSavedIdsLoaded(true);
    }
    fetchSaved();
  }, []);

  useEffect(() => {
    async function fetchListings() {
      // Filtering by saved needs the bookmark set first, or the query would
      // run with an empty allow-list and render "no results" for a beat.
      if (savedOnly && !savedIdsLoaded) return;
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      const result = await getActiveListings(currentPage, PAGE_SIZE, {
        industry: selectedIndustry || undefined,
        search: debouncedSearch || undefined,
        location: debouncedLocation || undefined,
        paid: paidFilter,
        mode: workModeFilter,
        duration: durationFilter || undefined,
        onlyIds: savedOnly ? Array.from(savedIds) : undefined,
      });
      setListings(result.data as Listing[]);
      setTotalCount(result.totalCount);
      setLoading(false);
    }
    fetchListings();
    // savedIds is intentionally not a dependency: un-saving a listing while
    // the Saved filter is on shouldn't yank the card out from under the click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedIndustry, debouncedSearch, debouncedLocation, paidFilter, workModeFilter, durationFilter, savedOnly, savedIdsLoaded]);

  async function toggleSaved(listingId: string) {
    if (!studentId) return;
    const wasSaved = savedIds.has(listingId);
    // Optimistic — a bookmark toggle should feel instant.
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(listingId); else next.add(listingId);
      return next;
    });
    try {
      if (wasSaved) await unsaveListing(studentId, listingId);
      else await saveListing(studentId, listingId);
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(listingId); else next.delete(listingId);
        return next;
      });
    }
  }

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

  const selectedListing = listings.find((l) => l.id === selectedId) || null;

  function handleIndustryFilter(industry: string) {
    setSelectedIndustry(industry);
  }

  const workModeLabel = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    'in-person': 'In-Person',
  } as const;

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (searchQuery) activeChips.push({ key: 'search', label: `“${searchQuery}”`, onRemove: () => setSearchQuery('') });
  if (locationFilter) activeChips.push({ key: 'location', label: locationFilter, onRemove: () => setLocationFilter('') });
  if (paidFilter !== 'all') activeChips.push({ key: 'paid', label: paidFilter === 'paid' ? 'Paid' : 'Unpaid', onRemove: () => setPaidFilter('all') });
  if (workModeFilter !== 'all') activeChips.push({ key: 'mode', label: workModeLabel[workModeFilter], onRemove: () => setWorkModeFilter('all') });
  if (durationFilter) activeChips.push({ key: 'duration', label: durationFilter, onRemove: () => setDurationFilter('') });
  if (selectedIndustry) activeChips.push({ key: 'industry', label: selectedIndustry, onRemove: () => setSelectedIndustry('') });

  function clearAllFilters() {
    setSearchQuery('');
    setLocationFilter('');
    setPaidFilter('all');
    setWorkModeFilter('all');
    setDurationFilter('');
    setSelectedIndustry('');
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
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
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
        {/* Filter section */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}>
          {/* All / Saved toggle — every other filter still applies on top */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {([
              { value: false, label: 'All jobs' },
              { value: true, label: `Saved${savedIds.size > 0 ? ` (${savedIds.size})` : ''}` },
            ] as const).map((opt) => {
              const active = savedOnly === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setSavedOnly(opt.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                    background: active ? 'var(--primary-light)' : 'var(--bg)',
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  }}
                >
                  {opt.value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div style={{ position: 'relative' }}>
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
          <div style={{ position: 'relative' }}>
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
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1.5px solid var(--border)',
                fontSize: '0.82rem',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.15s ease',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter dropdowns row */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* Salary dropdown */}
            <div ref={salaryRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <button
                onClick={() => { setSalaryOpen(!salaryOpen); setModeOpen(false); setIndustryOpen(false); setDurationOpen(false); }}
                style={{
                  ...selectStyle,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontWeight: paidFilter !== 'all' ? 600 : 500,
                  borderColor: salaryOpen ? 'var(--primary)' : 'var(--border)',
                }}
              >
                {paidFilter === 'all' ? 'Salary' : paidFilter === 'paid' ? 'Paid' : 'Unpaid'}
              </button>
              {salaryOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  minWidth: '140px',
                  background: 'var(--surface)',
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
            <div ref={modeRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <button
                onClick={() => { setModeOpen(!modeOpen); setSalaryOpen(false); setIndustryOpen(false); setDurationOpen(false); }}
                style={{
                  ...selectStyle,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontWeight: workModeFilter !== 'all' ? 600 : 500,
                  borderColor: modeOpen ? 'var(--primary)' : 'var(--border)',
                }}
              >
                {workModeFilter === 'all' ? 'Mode' : workModeFilter === 'remote' ? 'Remote' : workModeFilter === 'hybrid' ? 'Hybrid' : 'In-Person'}
              </button>
              {modeOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  minWidth: '140px',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  zIndex: 100,
                  overflow: 'hidden',
                  padding: '4px 0',
                }}>
                  {([['all', 'Any Mode'], ['remote', 'Remote'], ['hybrid', 'Hybrid'], ['in-person', 'In-Person']] as const).map(([val, label]) => (
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

            {/* Duration dropdown */}
            <div ref={durationRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <button
                onClick={() => { setDurationOpen(!durationOpen); setSalaryOpen(false); setModeOpen(false); setIndustryOpen(false); }}
                style={{
                  ...selectStyle,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontWeight: durationFilter ? 600 : 500,
                  borderColor: durationOpen ? 'var(--primary)' : 'var(--border)',
                  overflow: 'hidden',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {durationFilter || 'Length'}
                </span>
              </button>
              {durationOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  minWidth: '160px',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  zIndex: 100,
                  overflow: 'hidden',
                  padding: '4px 0',
                }}>
                  <button
                    onClick={() => { setDurationFilter(''); setDurationOpen(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '7px 12px',
                      border: 'none',
                      background: durationFilter === '' ? 'var(--primary-light)' : 'transparent',
                      color: durationFilter === '' ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: durationFilter === '' ? 600 : 400,
                      fontSize: '0.82rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => { if (durationFilter !== '') e.currentTarget.style.background = 'var(--bg)'; }}
                    onMouseLeave={(e) => { if (durationFilter !== '') e.currentTarget.style.background = 'transparent'; }}
                  >
                    Any Length
                  </button>
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => { setDurationFilter(d); setDurationOpen(false); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '7px 12px',
                        border: 'none',
                        background: durationFilter === d ? 'var(--primary-light)' : 'transparent',
                        color: durationFilter === d ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: durationFilter === d ? 600 : 400,
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => { if (durationFilter !== d) e.currentTarget.style.background = 'var(--bg)'; }}
                      onMouseLeave={(e) => { if (durationFilter !== d) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Industry searchable dropdown */}
            <div ref={industryRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <button
                onClick={() => { setIndustryOpen(!industryOpen); setIndustrySearch(''); setSalaryOpen(false); setModeOpen(false); setDurationOpen(false); }}
                style={{
                  ...selectStyle,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontWeight: selectedIndustry ? 600 : 500,
                  borderColor: industryOpen ? 'var(--primary)' : 'var(--border)',
                  overflow: 'hidden',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedIndustry || 'Industry'}
                </span>
              </button>

              {industryOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '220px',
                  background: 'var(--surface)',
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
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '3px 4px 3px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  color: 'var(--primary)',
                  background: 'var(--primary-light)',
                  borderRadius: '999px',
                  maxWidth: '160px',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chip.label}
                </span>
                <button
                  onClick={chip.onRemove}
                  aria-label={`Remove ${chip.label} filter`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    border: 'none',
                    borderRadius: '999px',
                    background: 'transparent',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(123,97,255,0.18)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
            <button
              onClick={clearAllFilters}
              style={{
                marginLeft: 'auto',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.76rem',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 6px',
                textDecoration: 'underline',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Listing cards or loading/empty */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>Loading internships...</p>
            </div>
          ) : listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
              </svg>
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                {savedOnly && savedIds.size === 0 ? 'No saved jobs yet' : 'No internships found'}
              </p>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                {savedOnly && savedIds.size === 0
                  ? 'Tap the bookmark on any job to save it here — no application needed.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            listings.map((listing) => (
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
                        color: selectedId === listing.id ? 'var(--on-primary)' : 'var(--primary)',
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
                        {listing.is_remote ? 'Remote' : listing.is_hybrid ? `Hybrid${listing.location ? ` · ${listing.location}` : ''}` : listing.location || 'Not specified'}
                      </span>
                      {(() => {
                        // Only the figure fits here; the employer's note lives
                        // on the detail pane behind a "more details" hint.
                        const { summary, note } = splitCompensation(listing.compensation);
                        if (!summary) return null;
                        return (
                          <>
                            <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 500 }}>
                              {summary}
                            </span>
                            {note && (
                              <span
                                title="This listing has extra compensation details — open it to read them"
                                style={{
                                  fontSize: '0.7rem', color: 'var(--text-secondary)',
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                more details
                              </span>
                            )}
                          </>
                        );
                      })()}
                      {(() => {
                        const state = deadlineState(listing.application_deadline);
                        if (state !== 'soon' && state !== 'expired') return null;
                        const styles = state === 'expired'
                          ? { bg: 'var(--danger-bg)', color: 'var(--danger-fg)' }
                          : { bg: 'var(--warning-bg)', color: 'var(--chip-amber-ink)' };
                        return (
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600,
                            padding: '2px 8px', borderRadius: '999px',
                            background: styles.bg, color: styles.color,
                          }}>
                            {state === 'expired' ? 'Closed' : `Closes ${formatDeadline(listing.application_deadline!)}`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {timeAgo(listing.created_at)}
                    </span>
                    <button
                      type="button"
                      // Stop the click from also selecting the card.
                      onClick={(e) => { e.stopPropagation(); toggleSaved(listing.id); }}
                      disabled={!studentId}
                      aria-pressed={savedIds.has(listing.id)}
                      aria-label={savedIds.has(listing.id) ? 'Remove bookmark' : 'Save this job'}
                      title={savedIds.has(listing.id) ? 'Saved — click to remove' : 'Save for later'}
                      style={{
                        background: 'none', border: 'none', padding: '2px',
                        cursor: studentId ? 'pointer' : 'default', lineHeight: 0,
                        color: savedIds.has(listing.id) ? 'var(--primary)' : 'var(--text-light)',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={savedIds.has(listing.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )))}

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
                <ListingBanner bannerUrl={selectedListing.banner_url} accentColor={selectedListing.accent_color} />

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
                  {(selectedListing.is_remote || selectedListing.is_hybrid) && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.82rem', color: 'var(--text-secondary)',
                      padding: '5px 12px', borderRadius: '6px',
                      background: 'var(--bg-secondary, #f5f5f5)',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                      {selectedListing.is_remote ? 'Remote' : 'Hybrid'}
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
                  {selectedListing.duration && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.82rem', color: 'var(--text-secondary)',
                      padding: '5px 12px', borderRadius: '6px',
                      background: 'var(--bg-secondary, #f5f5f5)',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {selectedListing.duration}
                    </span>
                  )}
                  {selectedListing.application_deadline && (() => {
                    const state = deadlineState(selectedListing.application_deadline);
                    const styles =
                      state === 'expired'
                        ? { bg: 'var(--danger-bg)', color: 'var(--danger-fg)' }
                        : state === 'soon'
                        ? { bg: 'var(--warning-bg)', color: 'var(--chip-amber-ink)' }
                        : { bg: 'var(--bg-secondary, #f5f5f5)', color: 'var(--text-secondary)' };
                    return (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.82rem', color: styles.color, fontWeight: state === 'expired' || state === 'soon' ? 600 : 400,
                        padding: '5px 12px', borderRadius: '6px',
                        background: styles.bg,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        {state === 'expired' ? 'Closed' : 'Apply by'} {formatDeadline(selectedListing.application_deadline)}
                      </span>
                    );
                  })()}
                </div>

                <RoleTagPills tags={selectedListing.role_tags} />

                {/* Apply / Save */}
                <div style={{ marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link
                    href={`/dashboard/student/internships/${selectedListing.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '11px 28px',
                      borderRadius: '10px',
                      background: 'var(--primary)',
                      color: 'var(--on-primary)',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      textDecoration: 'none',
                      transition: 'var(--transition)',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    Apply Now
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleSaved(selectedListing.id)}
                    disabled={!studentId}
                    aria-pressed={savedIds.has(selectedListing.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '11px 20px', borderRadius: '10px',
                      border: `1.5px solid ${savedIds.has(selectedListing.id) ? 'var(--primary)' : 'var(--border)'}`,
                      background: savedIds.has(selectedListing.id) ? 'var(--primary-light)' : 'transparent',
                      color: savedIds.has(selectedListing.id) ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '0.92rem',
                      cursor: studentId ? 'pointer' : 'default',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={savedIds.has(selectedListing.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    {savedIds.has(selectedListing.id) ? 'Saved' : 'Save'}
                  </button>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 24px' }} />

                {/* Core sections, in the order the employer arranged them */}
                <ListingCoreSectionsView
                  listing={selectedListing}
                  headingStyle={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}
                />

                {selectedListing.preferred_skills && selectedListing.preferred_skills.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                      Preferred Skills
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedListing.preferred_skills.map((skill) => (
                        <span key={skill} style={{
                          padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem',
                          background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500,
                        }}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                <ListingCustomBlocks sections={selectedSections} accentColor={selectedListing.accent_color} />

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
                    background: 'var(--bg-secondary, var(--chip-neutral-bg))',
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
                      color: 'var(--on-primary)',
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
  );
}
