'use client';

import { useEffect, useState } from 'react';
import { getWaitlist, type WaitlistEntry } from '@/lib/supabase';

const ROLE_PILL: Record<string, { bg: string; color: string; label: string }> = {
  student: { bg: '#e0e7ff', color: '#3730a3', label: 'Student' },
  employer: { bg: '#d1fae5', color: '#065f46', label: 'Employer' },
  other: { bg: '#f1f5f9', color: '#475569', label: 'Other' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const data = await getWaitlist();
      setEntries(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  async function refresh() {
    setRefreshing(true);
    const data = await getWaitlist();
    setEntries(data);
    setRefreshing(false);
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Waitlist</h2>
        <button
          onClick={refresh}
          className="btn-secondary"
          disabled={refreshing}
          style={{ fontSize: '0.85rem', padding: '8px 16px' }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Everyone who has signed up for early access, newest first.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading waitlist…</p>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No signups yet</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>New waitlist entries from the landing page will appear here.</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {entries.length} {entries.length === 1 ? 'person' : 'people'} on the waitlist
          </p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#fff' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Name</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Email</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Role</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const pill = ROLE_PILL[entry.role || 'other'] || ROLE_PILL.other;
                    return (
                      <tr key={entry.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 500 }}>{entry.full_name || '—'}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <a href={`mailto:${entry.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{entry.email}</a>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ background: pill.bg, color: pill.color, fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                            {pill.label}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          <span title={formatDate(entry.created_at)}>{relativeTime(entry.created_at)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
