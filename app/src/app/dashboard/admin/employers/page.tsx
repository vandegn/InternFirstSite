'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getEmployersForReview,
  setEmployerVerification,
  refreshVerificationSignals,
  VERIFICATION_LABELS,
  type VerificationStatus,
} from '@/lib/supabase';
import { triageLevel, type TriageLevel } from '@/lib/domain-signals';
import { VERIFICATION_CHIP } from '@/components/VerificationBanner';

const TRIAGE: Record<TriageLevel, { label: string; bg: string; color: string }> = {
  clear: { label: 'Looks clear', bg: '#d1fae5', color: '#065f46' },
  review: { label: 'Needs a look', bg: '#fef3c7', color: '#92400e' },
  suspect: { label: 'Check carefully', bg: '#fee2e2', color: '#991b1b' },
};

const FILTERS: { key: VerificationStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'needs_info', label: 'Awaiting Info' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

function formatAge(days: number | null | undefined): string {
  if (days == null) return 'Unknown';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} old`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} old`;
  const years = (days / 365).toFixed(1).replace(/\.0$/, '');
  return `${years} year${years === '1' ? '' : 's'} old`;
}

function Signal({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? '#065f46' : tone === 'bad' ? '#991b1b' : 'var(--text)';
  return (
    <div>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.85rem', color, fontWeight: 500, marginTop: '2px' }}>{value}</div>
    </div>
  );
}

type EmployerReviewRow = {
  id: string;
  company_name: string;
  website: string | null;
  description: string | null;
  created_at: string;
  verification_status: VerificationStatus;
  verification_note: string | null;
  email_domain: string | null;
  website_domain: string | null;
  domain_match: boolean | null;
  free_email_provider: boolean | null;
  domain_age_days: number | null;
  signals_error: string | null;
  profile: { full_name: string; email: string } | null;
  listings: { count: number }[] | null;
};

export default function AdminEmployerReviewPage() {
  const [employers, setEmployers] = useState<EmployerReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VerificationStatus | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    const data = await getEmployersForReview();
    setEmployers(data as unknown as EmployerReviewRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: employers.length };
    for (const e of employers) c[e.verification_status] = (c[e.verification_status] ?? 0) + 1;
    return c;
  }, [employers]);

  const visible = filter === 'all'
    ? employers
    : employers.filter((e) => e.verification_status === filter);

  async function decide(id: string, status: VerificationStatus) {
    // A rejection or an info request the employer can't act on is just a dead
    // end, so require the reviewer to say why.
    if ((status === 'rejected' || status === 'needs_info') && !notes[id]?.trim()) {
      setError('Add a note explaining what you need — the employer sees it.');
      return;
    }
    setError('');
    setBusy(id);
    try {
      await setEmployerVerification(id, status, notes[id] ?? null);
      setNotes((prev) => ({ ...prev, [id]: '' }));
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save that decision.');
    } finally {
      setBusy(null);
    }
  }

  async function recheck(id: string) {
    setBusy(id);
    await refreshVerificationSignals(id);
    await load();
    setBusy(null);
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Employer Verification</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
        Until an employer is approved their listings stay hidden from students and they cannot see
        applicants. The signals below are inputs, not a decision — a matching domain only proves
        someone bought a domain.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 500,
              cursor: 'pointer',
              border: `1px solid ${filter === f.key ? 'var(--primary)' : 'var(--border)'}`,
              background: filter === f.key ? 'var(--primary)' : 'var(--surface)',
              color: filter === f.key ? 'var(--on-primary)' : 'var(--text)',
            }}
          >
            {f.label}{counts[f.key] ? ` (${counts[f.key]})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading employers…</p>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 500 }}>Nothing here</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>No employers with this status.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {visible.map((e) => {
            const status = e.verification_status as VerificationStatus;
            const pill = VERIFICATION_CHIP[status];
            const triage = TRIAGE[triageLevel(e)];
            const listingCount = e.listings?.[0]?.count ?? 0;
            const isBusy = busy === e.id;

            return (
              <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{e.company_name}</h3>
                      <span style={{ background: pill.bg, color: pill.color, fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: '10px' }}>
                        {VERIFICATION_LABELS[status]}
                      </span>
                      {status !== 'approved' && (
                        <span style={{ background: triage.bg, color: triage.color, fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: '10px' }}>
                          {triage.label}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {e.profile?.full_name || '—'} ·{' '}
                      <a href={`mailto:${e.profile?.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        {e.profile?.email}
                      </a>{' '}
                      · {listingCount} listing{listingCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    onClick={() => recheck(e.id)}
                    className="btn-secondary"
                    disabled={isBusy}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', height: 'fit-content' }}
                  >
                    {isBusy ? 'Working…' : 'Re-run checks'}
                  </button>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px',
                  padding: '14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: '14px',
                }}>
                  <Signal
                    label="Domain age"
                    value={formatAge(e.domain_age_days)}
                    tone={e.domain_age_days == null ? 'neutral' : e.domain_age_days < 180 ? 'bad' : 'good'}
                  />
                  <Signal
                    label="Email provider"
                    value={e.free_email_provider ? 'Free / personal' : 'Company domain'}
                    tone={e.free_email_provider ? 'bad' : 'good'}
                  />
                  <Signal
                    label="Email ↔ website"
                    value={e.domain_match == null ? 'Not comparable' : e.domain_match ? 'Match' : 'Mismatch'}
                    tone={e.domain_match ? 'good' : 'neutral'}
                  />
                  <Signal label="Email domain" value={e.email_domain || '—'} tone="neutral" />
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Website
                    </div>
                    {e.website ? (
                      <a
                        href={e.website.startsWith('http') ? e.website : `https://${e.website}`}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 500, marginTop: '2px', display: 'inline-block' }}
                      >
                        {e.website_domain || e.website} ↗
                      </a>
                    ) : (
                      <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>—</div>
                    )}
                  </div>
                </div>

                {e.signals_error && (
                  <p style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: '12px' }}>
                    Automated check incomplete: {e.signals_error}. Verify this one by hand.
                  </p>
                )}

                {e.description && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                    {e.description}
                  </p>
                )}

                {e.verification_note && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', fontStyle: 'italic' }}>
                    Last note: {e.verification_note}
                  </p>
                )}

                <textarea
                  placeholder="Note to the employer (required to reject or request info)…"
                  rows={2}
                  value={notes[e.id] ?? ''}
                  onChange={(ev) => setNotes((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                  style={{
                    width: '100%', resize: 'vertical', padding: '8px 10px', fontSize: '0.85rem',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '10px',
                    fontFamily: 'inherit',
                  }}
                />

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {status !== 'approved' && (
                    <button onClick={() => decide(e.id, 'approved')} className="btn-primary" disabled={isBusy} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                      Approve
                    </button>
                  )}
                  {status !== 'needs_info' && (
                    <button onClick={() => decide(e.id, 'needs_info')} className="btn-secondary" disabled={isBusy} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                      Request info
                    </button>
                  )}
                  {status !== 'rejected' && (
                    <button
                      onClick={() => decide(e.id, 'rejected')}
                      disabled={isBusy}
                      style={{
                        fontSize: '0.82rem', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid #fecaca', background: 'var(--surface)', color: '#991b1b',
                        cursor: isBusy ? 'default' : 'pointer', fontWeight: 500,
                      }}
                    >
                      Reject
                    </button>
                  )}
                  {status === 'approved' && (
                    <button onClick={() => decide(e.id, 'pending')} className="btn-secondary" disabled={isBusy} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                      Revoke approval
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
