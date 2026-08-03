'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPoliciesForRole, type PolicyRole, type PolicyBlock } from '@/lib/policies';

/**
 * Signup-time legal acknowledgement.
 *
 * Shows the role-appropriate Terms & Conditions and Privacy Policy stacked in a
 * single scroll region, and keeps the "I Agree" action disabled until the user
 * has actually scrolled to the bottom of both. The content is rendered as HTML
 * (not a PDF embed) precisely so the scroll position is observable — the mandate
 * to "scroll through" can't be enforced against a native PDF viewer.
 *
 * Rendered through a portal onto document.body so the fixed overlay is measured
 * against the viewport rather than any transformed ancestor.
 */
export default function PolicyAgreementModal({
  role,
  onAgree,
  onClose,
}: {
  role: PolicyRole;
  onAgree: () => void;
  onClose: () => void;
}) {
  const docs = getPoliciesForRole(role);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  // 24px slack so sub-pixel rounding / trailing padding doesn't keep the gate
  // shut once the user has reached the bottom.
  const atBottom = (el: HTMLDivElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= 24;

  // Measured as the node mounts: if the policy is short enough that there's
  // nothing to scroll, don't trap the user — enable Accept immediately.
  const setScrollEl = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (el && atBottom(el)) setReachedEnd(true);
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (el && atBottom(el)) setReachedEnd(true);
  }

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // The modal only mounts after a client-side click, so there's no SSR/portal
  // hydration concern — but guard anyway for non-browser render passes.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Terms and Privacy Policy"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(17, 12, 34, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '720px',
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(17, 12, 34, 0.35)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Review &amp; Accept</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Please read the {role === 'student' ? 'Student' : 'Employer'} Terms &amp; Conditions and Privacy
            Policy in full. Scroll to the bottom to continue.
          </p>
        </div>

        <div
          ref={setScrollEl}
          onScroll={handleScroll}
          style={{
            padding: '16px 24px', overflowY: 'auto', flex: 1,
            fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-primary)',
          }}
        >
          {docs.map((doc, di) => (
            <section key={doc.title} style={{ marginTop: di === 0 ? 0 : '28px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px' }}>{doc.title}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Pilot Version {doc.version} · Effective {doc.effectiveDate}
              </p>
              {doc.blocks.map((b, i) => (
                <PolicyLine key={i} block={b} />
              ))}
            </section>
          ))}
          <div style={{ height: '4px' }} aria-hidden />
        </div>

        <div
          style={{
            padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          }}
        >
          <span style={{ fontSize: '0.76rem', color: reachedEnd ? '#16a34a' : 'var(--text-secondary)' }}>
            {reachedEnd ? 'Thanks for reading — you can accept now.' : 'Scroll to the end to enable Accept.'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: '0.84rem', fontWeight: 500, padding: '9px 16px', borderRadius: '9px',
                border: '1px solid var(--border)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!reachedEnd}
              onClick={() => { onAgree(); onClose(); }}
              className="btn-auth"
              style={{
                fontSize: '0.84rem', fontWeight: 600, padding: '9px 20px', borderRadius: '9px',
                width: 'auto', margin: 0,
                opacity: reachedEnd ? 1 : 0.5, cursor: reachedEnd ? 'pointer' : 'not-allowed',
              }}
            >
              I Agree
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PolicyLine({ block }: { block: PolicyBlock }) {
  if (block.type === 'h') {
    return <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '18px 0 6px' }}>{block.text}</h4>;
  }
  if (block.type === 'li') {
    return (
      <div style={{ display: 'flex', gap: '8px', margin: '4px 0 4px 4px' }}>
        <span aria-hidden style={{ color: 'var(--primary)', lineHeight: 1.6 }}>•</span>
        <span>{block.text}</span>
      </div>
    );
  }
  return <p style={{ margin: '0 0 10px' }}>{block.text}</p>;
}
