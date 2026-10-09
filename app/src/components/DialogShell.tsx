'use client';

import { useEffect, useId, useRef } from 'react';
import ModalPortal from '@/components/ModalPortal';

// A centered modal dialog: header with an obvious close button, a scrolling
// body, an optional pinned footer. Shared by the candidate application modal
// and the scheduling dialogs that open on top of it.
//
// Dialogs can stack (Request Time opens over the candidate modal), so Escape
// only closes the topmost one, the page's scroll lock is reference-counted,
// and focus returns to whatever opened each dialog — which is also what keeps
// the employer's place in the candidate list when they close it.

const openStack: string[] = [];
let scrollLocks = 0;

type Props = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Accessible name when the title isn't plain text. */
  ariaLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Max width in px. */
  width?: number;
  /** Blocks Escape / backdrop / close while something is saving. */
  busy?: boolean;
  zIndex?: number;
};

export default function DialogShell({
  open,
  onClose,
  title,
  subtitle,
  ariaLabel,
  children,
  footer,
  width = 520,
  busy = false,
  zIndex = 9999,
}: Props) {
  const id = useId();
  const titleId = `${id}-title`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    openStack.push(id);
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden';
    // Move focus into the dialog so keyboard users land in it.
    requestAnimationFrame(() => dialogRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== id || busyRef.current) return;
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const at = openStack.lastIndexOf(id);
      if (at !== -1) openStack.splice(at, 1);
      if (--scrollLocks === 0) document.body.style.overflow = '';
      // preventScroll: returning focus must not scroll the list underneath.
      opener?.focus?.({ preventScroll: true });
    };
  }, [open, id]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.5)', padding: 'clamp(8px, 3vw, 24px)',
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-label={ariaLabel}
          tabIndex={-1}
          style={{
            width: '100%', maxWidth: width, maxHeight: 'min(92vh, 1000px)',
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)', boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none',
          }}
        >
          <div style={{
            padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <h2 id={titleId} style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{title}</h2>
              {subtitle && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close dialog"
              style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-secondary)', cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {children}
          </div>

          {footer && (
            <div style={{
              padding: '14px 24px 18px', borderTop: '1px solid var(--border)', flexShrink: 0,
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

// Button styles shared by the dialogs, so actions look the same everywhere.
export const primaryButton = (enabled = true): React.CSSProperties => ({
  padding: '9px 18px', borderRadius: 8, border: 'none',
  background: enabled ? 'var(--primary)' : 'var(--border)',
  color: 'var(--on-primary)', fontSize: '0.84rem', fontWeight: 600,
  cursor: enabled ? 'pointer' : 'not-allowed',
});

export const secondaryButton = (enabled = true): React.CSSProperties => ({
  padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
  cursor: enabled ? 'pointer' : 'not-allowed',
});
