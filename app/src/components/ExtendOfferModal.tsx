'use client';

import { useState, useEffect, useRef } from 'react';
import ModalPortal from '@/components/ModalPortal';

export type ExtendOfferFormData = {
  letter: File | null;
  note: string;
};

type Props = {
  open: boolean;
  candidateName: string;
  listingTitle?: string;
  stageLabel: string;
  onCancel: () => void;
  onConfirm: (data: ExtendOfferFormData) => Promise<void> | void;
};

// The second of the two confirmations guarding the Offered column. The first
// dialog is the generic "move this candidate?" one every column gets; this one
// exists because the move is not really a move — it tells someone they got the
// job. So it deliberately looks different from the rest of the board's dialogs:
// it leads with what the candidate is about to experience, and its primary
// button names them rather than saying "Confirm".
export default function ExtendOfferModal({
  open,
  candidateName,
  listingTitle,
  stageLabel,
  onCancel,
  onConfirm,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [letter, setLetter] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setLetter(null);
    setNote('');
    if (fileRef.current) fileRef.current.value = '';
  }, [open]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 240);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel, submitting]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!visible) return null;

  const firstName = candidateName.trim().split(/\s+/)[0] || candidateName;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    // Caught here rather than at submit, so the employer isn't told after
    // they've committed.
    if (file && !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setError('The offer letter must be a PDF.');
      setLetter(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setError('');
    setLetter(file);
  }

  async function handleConfirm() {
    setError('');
    setSubmitting(true);
    try {
      await onConfirm({ letter, note: note.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sending the offer failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalPortal>
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current && !submitting) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: animating ? 'rgba(15, 23, 42, 0.55)' : 'rgba(15, 23, 42, 0)',
        backdropFilter: animating ? 'blur(4px)' : 'blur(0px)',
        WebkitBackdropFilter: animating ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.24s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        padding: '24px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Confirm the offer to ${candidateName}`}
        style={{
          width: '100%', maxWidth: 500, background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.18)',
          border: '1px solid var(--border, #e5e7eb)',
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          opacity: animating ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header — green rail, so it reads as the final step and not a repeat
            of the dialog the employer just cleared. */}
        <div style={{
          padding: '20px 28px 16px',
          borderBottom: '1px solid var(--border, #f3f4f6)',
          borderLeft: '4px solid var(--chip-green-ink)',
          background: 'var(--chip-green-bg)',
        }}>
          <p style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--chip-green-ink)', margin: '0 0 4px',
          }}>
            Step 2 of 2 — final confirmation
          </p>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, marginBottom: 2 }}>
            Send {candidateName} an offer?
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            {listingTitle ? `${listingTitle} · moving to ${stageLabel}` : `Moving to ${stageLabel}`}
          </p>
        </div>

        <div style={{ padding: '20px 28px 8px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* What actually happens — the reason this second step exists. */}
          <ul style={{
            margin: 0, padding: '12px 14px 12px 30px', listStyle: 'disc',
            background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
            fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <li>{firstName} is notified right away that they&apos;re receiving an offer.</li>
            <li>They can read the letter and accept or decline in-platform.</li>
            <li>You&apos;ll be notified of their answer, and the card will show it.</li>
          </ul>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
              Offer letter (PDF, optional)
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              ref={fileRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 16px', borderRadius: 8,
                border: letter ? '1.5px solid var(--accent)' : '1.5px dashed var(--border)',
                background: letter ? 'var(--accent-light)' : 'var(--surface)',
                color: letter ? 'var(--accent-dark)' : 'var(--text-secondary)',
                fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {letter ? letter.name : 'Attach the offer letter'}
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
              Only {firstName} and your team can open it. You can send the offer now and
              follow up with the letter later.
            </span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
              Note for {firstName} (optional)
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Start date, next steps, who to reply to…"
              rows={3}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)', resize: 'vertical',
              }}
            />
          </label>

          {error && (
            <div role="alert" style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--danger-bg)', color: 'var(--danger-fg)',
              fontSize: '0.78rem', border: '1px solid var(--danger-border)',
            }}>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 28px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8,
          borderTop: '1px solid var(--border, #f3f4f6)', marginTop: 8,
        }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: submitting ? 'var(--border)' : 'var(--chip-green-ink)',
              color: '#fff', fontSize: '0.82rem', fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Sending…' : `Send offer to ${firstName}`}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
