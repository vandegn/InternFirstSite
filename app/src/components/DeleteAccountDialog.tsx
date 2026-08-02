'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Props = {
  open: boolean;
  onClose: () => void;
  role: 'student' | 'employer';
};

const ROLE_CONSEQUENCES: Record<Props['role'], string[]> = {
  student: [
    'You will be signed out and will no longer be able to log in.',
    'Your applications are withdrawn from employers’ active pipelines.',
    'Your profile, resumes, and messages stop being visible on the platform.',
  ],
  employer: [
    'You will be signed out and will no longer be able to log in.',
    'All of your active listings are closed and stop accepting applications.',
    'Your company profile and candidate pipelines stop being visible.',
  ],
};

// Deleting is a soft delete: the account is locked immediately, but the data is
// retained for six months before being permanently purged. That retention
// window is stated plainly here — it's the part users are most likely to be
// surprised by, and support needs them to have seen it.
export default function DeleteAccountDialog({ open, onClose, role }: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const canSubmit = confirmation.trim().toUpperCase() === 'DELETE' && !submitting;

  async function handleDelete() {
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE', reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not delete your account.');
      }
      await supabase.auth.signOut();
      router.replace('/?deleted=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account.');
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: 24,
      }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px',
        maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>
          Delete your account
        </h3>

        <ul style={{
          margin: '0 0 16px', paddingLeft: 18, display: 'grid', gap: 6,
          fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          {ROLE_CONSEQUENCES[role].map((line) => <li key={line}>{line}</li>)}
        </ul>

        <div style={{
          padding: '12px 14px', borderRadius: 'var(--radius-sm)',
          background: 'var(--info-bg, var(--bg))', border: '1px solid var(--border)',
          fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
          marginBottom: 20,
        }}>
          <strong style={{ color: 'var(--text)' }}>Your data is kept for 6 months.</strong>{' '}
          We retain your account information for six months in case you need it restored
          or a dispute needs resolving, then permanently delete it. To restore your account
          within that window, contact{' '}
          <a href="mailto:support@intern-first.com" style={{ color: 'var(--primary)', fontWeight: 500 }}>
            support@intern-first.com
          </a>.
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
            Why are you leaving? <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>(optional)</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="This helps us improve InternFirst."
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', fontSize: '0.85rem',
              fontFamily: 'inherit', resize: 'vertical', background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
            Type <strong>DELETE</strong> to confirm
          </span>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            placeholder="DELETE"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', fontSize: '0.9rem',
              background: 'var(--surface)', color: 'var(--text)',
            }}
          />
        </label>

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
            background: 'var(--danger-bg)', color: 'var(--danger-fg)',
            border: '1px solid var(--danger-border)', fontSize: '0.8rem',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary"
            style={{ padding: '10px 24px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canSubmit}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--danger-border)',
              background: canSubmit ? 'var(--danger-bg)' : 'var(--surface)',
              color: 'var(--danger-accent)', fontWeight: 600, fontSize: '0.9rem',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.55,
            }}
          >
            {submitting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  );
}
