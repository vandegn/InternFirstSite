'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOfferById, type Offer } from '@/lib/supabase';

type LoadedOffer = Offer & {
  listing?: { id: string; title: string } | null;
  employer?: { id: string; company_name: string; logo_url: string | null } | null;
};

type Props = {
  offerId: string;
  /** The student it was made to can act on it; the employer sees it read-only. */
  canRespond: boolean;
};

const STATUS_TEXT: Record<Offer['status'], string> = {
  extended: 'Awaiting your answer',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

// The offer, rendered inline in the inbox thread in place of a plain message
// bubble — the same treatment the availability request gets, for the same
// reason: it is something to act on, not something to read. Accepting and
// declining deliberately live on the applications page rather than here, so
// there is exactly one place where that decision is made (and one place that
// asks twice before declining).
export default function OfferMessageCard({ offerId, canRespond }: Props) {
  const [offer, setOffer] = useState<LoadedOffer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOfferById(offerId).then((data) => {
      if (cancelled) return;
      setOffer(data as LoadedOffer | null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [offerId]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Loading offer…</p>
      </div>
    );
  }

  // Withdrawn out from under them, or never visible to this account.
  if (!offer) {
    return (
      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          This offer is no longer available.
        </p>
      </div>
    );
  }

  const answered = offer.status !== 'extended';

  return (
    <div style={{ ...cardStyle, borderLeft: '4px solid var(--chip-green-ink)' }}>
      <p style={{
        margin: '0 0 4px', fontSize: '0.66rem', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--chip-green-ink)',
      }}>
        Offer
      </p>
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
        {offer.listing?.title ?? 'This role'}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {offer.employer?.company_name ?? 'The employer'} · {STATUS_TEXT[offer.status]}
      </p>

      {offer.note && (
        <p style={{
          margin: '10px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap', lineHeight: 1.5,
        }}>
          {offer.note}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {offer.storage_path && (
          <a
            href={`/api/files/offer/${offer.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid var(--chip-green-ink)', background: 'var(--surface)',
              color: 'var(--chip-green-ink)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Offer letter
          </a>
        )}
        {canRespond && (
          <Link
            href={`/dashboard/student/applications?offer=${offer.id}`}
            style={{
              padding: '7px 14px', borderRadius: 8,
              background: answered ? 'var(--surface)' : 'var(--chip-green-ink)',
              border: answered ? '1px solid var(--border)' : 'none',
              color: answered ? 'var(--text)' : '#fff',
              fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            {answered ? 'View offer' : 'Review and respond'}
          </Link>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  maxWidth: '85%',
  width: 420,
  padding: '14px 16px',
  borderRadius: 16,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
};
