'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  supabase,
  getEmployerByUserId,
  getEmployerPayments,
  getEmployerListings,
} from '@/lib/supabase';
import { formatCents } from '@/lib/constants';

type Payment = {
  id: string;
  type: 'ppj_upfront' | 'ppa_monthly';
  amount_cents: number;
  status: string;
  billing_period: string | null;
  created_at: string;
  listing?: { title: string } | null;
};

type Listing = {
  id: string;
  title: string;
  pricing_model: 'ppj' | 'ppa' | null;
  applicant_count: number;
  cpa_cents: number | null;
  status: string;
  payment_status: string;
};

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [hasCard, setHasCard] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [savingCard, setSavingCard] = useState(false);
  const [cardError, setCardError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (!employer) { setLoading(false); return; }

      const [syncRes, pays, listed] = await Promise.all([
        fetch('/api/billing/sync', { method: 'POST' }).then((r) => r.json()).catch(() => ({ hasCard: false })),
        getEmployerPayments(employer.id),
        getEmployerListings(employer.id, 1, 100),
      ]);

      setHasCard(!!syncRes.hasCard);
      setPayments(pays as Payment[]);
      setListings((listed.data as Listing[]).filter((l) => l.pricing_model));
      setLoading(false);
    }
    load();
  }, []);

  async function manageCard() {
    setSavingCard(true);
    setCardError('');
    try {
      const res = await fetch('/api/billing/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: '/dashboard/employer/billing' }),
      });
      const json = await res.json();
      if (json.url) { window.location.href = json.url; return; }
      setCardError(json.error || 'Could not start card setup.');
    } catch {
      setCardError('Could not reach the billing service.');
    }
    setSavingCard(false);
  }

  if (loading) {
    return <div className="dash-main" style={{ padding: '32px' }}>Loading…</div>;
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>Billing</h1>

      {/* Payment method */}
      <div className="profile-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Payment method</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '6px 0 0' }}>
              {hasCard ? '✓ Card on file — used for monthly Pay-Per-Applicant billing.' : 'No card on file yet.'}
            </p>
          </div>
          <button onClick={manageCard} disabled={savingCard} className="btn-primary" style={{ padding: '10px 18px' }}>
            {savingCard ? 'Opening…' : hasCard ? 'Update card' : 'Add card'}
          </button>
        </div>
        {cardError && (
          <p style={{ color: 'var(--danger, #dc2626)', fontSize: '0.85rem', margin: '12px 0 0' }}>{cardError}</p>
        )}
      </div>

      {/* Active plans / usage */}
      <div className="profile-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Listing usage</h2>
        {listings.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No paid listings yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {listings.map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div>
                  <Link href={`/dashboard/employer/listings/${l.id}/edit`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>{l.title}</Link>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {l.pricing_model === 'ppj' ? 'Pay Per Job' : 'Pay Per Applicant'}
                    {' · '}
                    {l.status === 'closed' ? 'Closed' : l.payment_status === 'pending' ? 'Awaiting payment' : 'Active'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{l.applicant_count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {l.pricing_model === 'ppj'
                      ? 'applications'
                      : `applications · ${l.cpa_cents != null ? formatCents(l.cpa_cents) : '—'} ea`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="profile-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Payment history</h2>
        {payments.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No payments yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {payments.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {p.type === 'ppj_upfront' ? `Job posting${p.listing?.title ? `: ${p.listing.title}` : ''}` : `Monthly applicants${p.billing_period ? ` — ${p.billing_period}` : ''}`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{formatCents(p.amount_cents)}</div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'capitalize', color: p.status === 'paid' ? 'var(--success, #16a34a)' : p.status === 'failed' ? 'var(--danger, #dc2626)' : 'var(--text-secondary)' }}>{p.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
