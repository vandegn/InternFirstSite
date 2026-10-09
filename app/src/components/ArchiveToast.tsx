'use client';

import { useEffect, useState } from 'react';
import ModalPortal from './ModalPortal';
import type { ArchiveToast as ArchiveToastState } from '@/lib/use-application-archive';

// The brief confirmation after archiving / restoring an application, with an
// Undo. Announced politely (role="status"); failures are announced
// assertively (role="alert"). The timer pauses while the pointer or keyboard
// focus is on the toast so nobody loses the Undo button mid-reach.

const VISIBLE_MS = 6000;
const ERROR_VISIBLE_MS = 9000;

export default function ArchiveToast({
  toast,
  onDismiss,
}: {
  toast: ArchiveToastState | null;
  onDismiss: () => void;
}) {
  // Keyed by toast id so a pause can't leak into the next toast (the focused
  // Undo button unmounts without a blur).
  const [pausedId, setPausedId] = useState<number | null>(null);
  const paused = toast !== null && pausedId === toast.id;

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(onDismiss, toast.tone === 'error' ? ERROR_VISIBLE_MS : VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused, onDismiss]);

  if (!toast) return null;

  return (
    <ModalPortal>
      <div
        key={toast.id}
        className={`app-toast${toast.tone === 'error' ? ' app-toast-error' : ''}`}
        role={toast.tone === 'error' ? 'alert' : 'status'}
        aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
        onMouseEnter={() => setPausedId(toast.id)}
        onMouseLeave={() => setPausedId(null)}
        onFocus={() => setPausedId(toast.id)}
        onBlur={() => setPausedId(null)}
      >
        <span className="app-toast-message">{toast.message}</span>
        {toast.undo && (
          <button
            type="button"
            className="app-toast-undo"
            onClick={() => {
              const undo = toast.undo;
              onDismiss();
              undo?.();
            }}
          >
            Undo
          </button>
        )}
        <button
          type="button"
          className="app-toast-close"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </ModalPortal>
  );
}
