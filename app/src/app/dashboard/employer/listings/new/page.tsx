'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getEmployerByUserId, createListing, getEmployerBilling } from '@/lib/supabase';
import {
  INDUSTRIES,
  DURATIONS,
  POSTING_DURATIONS,
  PPJ_APPLICATION_RANGES,
  PPA_MATCH_THRESHOLD,
  computePpjPriceCents,
  cpaForIndustry,
  formatCents,
  type PricingModel,
} from '@/lib/constants';
import ReactMarkdown from 'react-markdown';

function AutoResizeTextarea({ id, placeholder, required, rows, value, onChange, style }: {
  id: string;
  placeholder: string;
  required?: boolean;
  rows: number;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  style?: React.CSSProperties;
}) {
  const ref = useCallback((node: HTMLTextAreaElement | null) => {
    if (node) {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 2 + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      placeholder={placeholder}
      required={required}
      rows={rows}
      value={value}
      onChange={onChange}
      style={style}
    />
  );
}

export default function NewListingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<'in-person' | 'hybrid' | 'remote'>('in-person');
  const [compensation, setCompensation] = useState('');
  const [requirements, setRequirements] = useState('');
  const [keyResponsibilities, setKeyResponsibilities] = useState('');
  const [industry, setIndustry] = useState('');
  const [duration, setDuration] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null);
  const [employerId, setEmployerId] = useState<string | null>(null);

  // ── Plan / billing ──
  const [pricingModel, setPricingModel] = useState<PricingModel>('ppj');
  const [postingDays, setPostingDays] = useState<number>(POSTING_DURATIONS[0].days);
  const [rangeIndex, setRangeIndex] = useState<number>(2);
  const [hasCard, setHasCard] = useState(false);

  const cpaCents = cpaForIndustry(industry);
  const selectedRange = PPJ_APPLICATION_RANGES[rangeIndex];
  const ppjPrice = computePpjPriceCents(industry, selectedRange);

  useEffect(() => {
    async function fetchEmployer() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (employer) {
        setCompanyName(employer.company_name || '');
        setCompanyLogo(employer.logo_url || null);
        setCompanyWebsite(employer.website || null);
        setEmployerId(employer.id);
        const billing = await getEmployerBilling(employer.id);
        setHasCard(!!billing?.default_payment_method);
      }
    }
    fetchEmployer();
  }, []);

  async function startCardSetup() {
    const res = await fetch('/api/billing/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTo: '/dashboard/employer/listings/new' }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else setError(json.error || 'Could not start card setup.');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!employerId) throw new Error('Employer profile not found.');

      if (pricingModel === 'ppa' && !hasCard) {
        setLoading(false);
        await startCardSetup();
        return;
      }

      const base = {
        employer_id: employerId,
        title,
        description,
        location: location || undefined,
        is_remote: workMode === 'remote',
        is_hybrid: workMode === 'hybrid',
        compensation: compensation || undefined,
        requirements: requirements || undefined,
        key_responsibilities: keyResponsibilities || undefined,
        industry,
        duration: duration || undefined,
        application_deadline: applicationDeadline || undefined,
      };

      if (pricingModel === 'ppj') {
        // Create paused/pending, then send to Stripe Checkout. The webhook
        // activates the listing and sets expires_at once payment succeeds.
        const listing = await createListing({
          ...base,
          pricing_model: 'ppj',
          applicant_quota: selectedRange.max,
          cpa_cents: cpaCents,
          status: 'paused',
          payment_status: 'pending',
        });

        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id, durationDays: postingDays, rangeIndex }),
        });
        const json = await res.json();
        if (json.url) {
          window.location.href = json.url;
          return;
        }
        throw new Error(json.error || 'Could not start checkout.');
      }

      // PPA — active immediately, billed monthly per qualifying application.
      const expiresAt = new Date(Date.now() + postingDays * 86400_000).toISOString();
      await createListing({
        ...base,
        pricing_model: 'ppa',
        cpa_cents: cpaCents,
        expires_at: expiresAt,
        status: 'active',
        payment_status: 'active',
      });

      router.push('/dashboard/employer/posted-jobs');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <Link href="/dashboard/employer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Post New Listing</h1>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-light)', padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--border)' }}>Live Preview</span>
      </div>

      {error && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* ── Left: Form ── */}
        <div className="profile-card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Listing Details</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Job Title</label>
                <input
                  type="text"
                  id="title"
                  placeholder="e.g. Software Engineer Intern"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="compensation">Compensation</label>
                <select
                  id="compensation"
                  value={compensation}
                  onChange={(e) => setCompensation(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select compensation...</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="$10-15/hr">$10-15/hr</option>
                  <option value="$15-20/hr">$15-20/hr</option>
                  <option value="$20-25/hr">$20-25/hr</option>
                  <option value="$25-30/hr">$25-30/hr</option>
                  <option value="$30-35/hr">$30-35/hr</option>
                  <option value="$35-40/hr">$35-40/hr</option>
                  <option value="$40+/hr">$40+/hr</option>
                  <option value="Stipend">Stipend (flat rate)</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <select
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  placeholder="e.g. Raleigh, NC"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="applicationDeadline">
                  Application Deadline <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="date"
                    id="applicationDeadline"
                    value={applicationDeadline}
                    onChange={(e) => setApplicationDeadline(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {applicationDeadline && (
                    <button
                      type="button"
                      onClick={() => setApplicationDeadline('')}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  Leave blank for no deadline — the listing stays open until you close it.
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="duration">Internship Length</label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select length...</option>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Work Arrangement</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['in-person', 'hybrid', 'remote'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWorkMode(mode)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: workMode === mode ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                        background: workMode === mode ? 'var(--primary-light)' : 'var(--bg)',
                        color: workMode === mode ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: workMode === mode ? 600 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s',
                      }}
                    >
                      {mode === 'in-person' ? 'In-Person' : mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Job Overview</label>
              <AutoResizeTextarea
                id="description"
                placeholder="Describe the role and what the intern will learn...&#10;&#10;Tip: Use - for bullet points"
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="requirements">Qualifications</label>
              <AutoResizeTextarea
                id="requirements"
                placeholder="List skills, qualifications, or experience needed...&#10;&#10;Tip: Use - for bullet points"
                rows={4}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="keyResponsibilities">Key Responsibilities</label>
              <AutoResizeTextarea
                id="keyResponsibilities"
                placeholder="List the main duties and responsibilities of the role...&#10;&#10;Tip: Use - for bullet points"
                rows={4}
                value={keyResponsibilities}
                onChange={(e) => setKeyResponsibilities(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            {/* ── Posting Plan ── */}
            <div className="form-group" style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <label style={{ fontSize: '1.05rem', fontWeight: 600 }}>Posting Plan</label>

              <div style={{ display: 'flex', gap: 10, marginTop: '8px' }}>
                {([
                  { key: 'ppj', title: 'Pay Per Job', sub: 'One fixed upfront fee based on your estimate.' },
                  { key: 'ppa', title: 'Pay Per Application', sub: 'No upfront cost. Billed monthly per qualifying application.' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPricingModel(opt.key)}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      padding: '14px',
                      borderRadius: 10,
                      border: pricingModel === opt.key ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: pricingModel === opt.key ? 'var(--primary-light)' : 'var(--bg)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: pricingModel === opt.key ? 'var(--primary)' : 'var(--text-primary)' }}>{opt.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="postingDays">Posting Duration</label>
                <select
                  id="postingDays"
                  value={postingDays}
                  onChange={(e) => setPostingDays(Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  {POSTING_DURATIONS.map((d) => (
                    <option key={d.days} value={d.days}>{d.label}</option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  How long the listing stays live. Doesn&apos;t affect price.
                </small>
              </div>

              {pricingModel === 'ppj' && (
                <div className="form-group">
                  <label htmlFor="rangeIndex">Estimated Applications</label>
                  <select
                    id="rangeIndex"
                    value={rangeIndex}
                    onChange={(e) => setRangeIndex(Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {PPJ_APPLICATION_RANGES.map((r, i) => (
                      <option key={r.label} value={i}>{r.label}</option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                    Fixed fee based on this estimate — you&apos;re never charged more if applications run higher.
                  </small>
                </div>
              )}
            </div>

            {/* Price / billing summary — both tiers anchored to the industry CPA */}
            {pricingModel === 'ppj' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-light)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {selectedRange.min}–{selectedRange.max} apps · {formatCents(cpaCents)}/app{!industry && ' (blended)'}
                </span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCents(ppjPrice)}</span>
              </div>
            ) : (
              <div style={{ padding: '14px 16px', background: 'var(--bg-light)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Per qualifying application{!industry && ' (blended CPA)'}, billed monthly
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCents(cpaCents)}</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  Only applications scoring {PPA_MATCH_THRESHOLD}%+ match are billed. No cap.
                </div>
                {!hasCard && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>A card on file is required for monthly billing.</span>
                    <button type="button" onClick={startCardSetup} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Add card
                    </button>
                  </div>
                )}
                {hasCard && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>✓ Card on file</div>
                )}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '1rem' }}>
              {loading
                ? 'Posting...'
                : pricingModel === 'ppj'
                  ? `Continue to Payment · ${formatCents(ppjPrice)}`
                  : 'Post Listing'}
            </button>
          </form>
        </div>

        {/* ── Right: Live Preview (mirrors student detail page) ── */}
        <div style={{ position: 'sticky', top: '32px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Student Preview
          </div>
          <div className="profile-card" style={{ padding: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1.4rem' }}>
                  {companyName.charAt(0) || '?'}
                </div>
              )}
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: title ? 'var(--text)' : 'var(--text-light)' }}>
                  {title || 'Job Title'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>{companyName || 'Your Company'}</p>
              </div>
            </div>

            {/* Meta info */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              {location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {location}
                </div>
              )}
              {workMode !== 'in-person' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  {workMode === 'remote' ? 'Remote' : 'Hybrid'}
                </div>
              )}
              {compensation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  {compensation}
                </div>
              )}
              {industry && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  {industry}
                </div>
              )}
              {duration && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {duration}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Posted {new Date().toLocaleDateString()}
              </div>
              {applicationDeadline && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  Apply by {new Date(applicationDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>

            <div className="sidebar-divider" style={{ margin: '24px 0' }}></div>

            {/* Qualifications */}
            {requirements ? (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Qualifications</h3>
                <div className="markdown-content"><ReactMarkdown>{requirements}</ReactMarkdown></div>
              </div>
            ) : (
              <div style={{ marginBottom: '24px', padding: '16px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm, 8px)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-light)' }}>Qualifications</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>Fill in the Qualifications field to preview...</p>
              </div>
            )}

            {/* Job Overview */}
            {description ? (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Job Overview</h3>
                <div className="markdown-content"><ReactMarkdown>{description}</ReactMarkdown></div>
              </div>
            ) : (
              <div style={{ marginBottom: '24px', padding: '16px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm, 8px)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-light)' }}>Job Overview</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>Fill in the Job Overview field to preview...</p>
              </div>
            )}

            {/* Key Responsibilities */}
            {keyResponsibilities ? (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Key Responsibilities</h3>
                <div className="markdown-content"><ReactMarkdown>{keyResponsibilities}</ReactMarkdown></div>
              </div>
            ) : (
              <div style={{ marginBottom: '24px', padding: '16px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm, 8px)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-light)' }}>Key Responsibilities</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>Fill in the Key Responsibilities field to preview...</p>
              </div>
            )}

            {/* Company Website */}
            {companyWebsite && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Company Website</h3>
                <span style={{ color: 'var(--primary)' }}>{companyWebsite}</span>
              </div>
            )}

            <div className="sidebar-divider" style={{ margin: '24px 0' }}></div>

            {/* Apply button (disabled in preview) */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                disabled
                className="btn-primary"
                style={{ padding: '12px 32px', fontSize: '1rem', opacity: 0.6, cursor: 'default' }}
              >
                Apply Now
              </button>
              <button
                disabled
                style={{ padding: '12px 24px', fontSize: '0.9rem', borderRadius: '10px', border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'default', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Message Employer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
